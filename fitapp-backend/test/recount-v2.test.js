const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { connectTestDb, resetTestDb, disconnectTestDb, daysFromToday, ymd } = require('./db');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const FitnessHistory = require('../models/FitnessHistory');
const { recountV2Challenge, finalizeV2Days, scoreParticipant } = require('../services/scoring/recountV2');

let app;
let internals;
before(async () => {
  await connectTestDb();
  app = await startApp();
  internals = require('../index.js').internals;
});
after(async () => {
  await app.close();
  await disconnectTestDb();
});
beforeEach(resetTestDb);

async function seed(mode, { users = ['u1'], daysAgo = 7, startingWeight = 200, rows = {} } = {}) {
  const challenge = await Challenge.create({
    name: `${mode} test`,
    scoringMode: mode,
    startDate: ymd(daysFromToday(-daysAgo)),
    endDate: ymd(daysFromToday(21)),
    stepGoal: 10000,
    weighInDay: 'monday',
    participants: users,
    admin: users[0],
  });
  for (const u of users) {
    await ChallengeParticipant.create({ challengeId: challenge._id.toString(), userId: u, startingWeight });
    for (const [offset, data] of Object.entries(rows[u] || {})) {
      await FitnessHistory.create({ userId: u, date: daysFromToday(Number(offset)), ...data });
    }
  }
  return challenge;
}

test('existing challenges and participants read as Classic', async () => {
  const raw = await Challenge.collection.insertOne({ name: 'legacy', stepGoal: 10000 });
  const c = await Challenge.findById(raw.insertedId);
  assert.equal(c.scoringMode, 'classic');
  const p = await ChallengeParticipant.create({ challengeId: 'x', userId: 'y' });
  assert.equal(p.scoringMode, undefined);
  assert.equal(p.totalPoints, undefined);
});

test('recount stores the v2 breakdown and mirrors the total into points', async () => {
  const c = await seed('v2', { rows: { u1: { '-3': { steps: 12500, effortPoints: 45, strengthSessions: 1 }, '-2': { steps: 6100 } } } });
  const [{ participant, result }] = await recountV2Challenge(c);
  // day -3: 12 steps (cap) + 2 bonus + 4.5 effort + 4 strength; day -2: 6.1 steps
  assert.equal(result.total, 28.6);
  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.scoringMode, 'v2');
  assert.equal(p.totalPoints, 28.6);
  assert.equal(p.points, 28.6);
  assert.equal(p.stepPoints, 18.1);
  assert.equal(p.goalBonusPoints, 2);
  assert.equal(p.effortPoints, 4.5);
  assert.equal(p.strengthPoints, 4);
});

test('Classic code paths cannot overwrite a v2 participant\'s points', async () => {
  const c = await seed('v2', { rows: { u1: { '-2': { steps: 11000 } } } });
  await recountV2Challenge(c);
  const p = await ChallengeParticipant.findOne({ userId: 'u1' });
  const before = p.points;
  p.points = 999; // what a Classic writer would do
  p.weightLossPoints = 50;
  p.lastWeight = 190; // non-score fields still save
  await p.save();
  const after = await ChallengeParticipant.findOne({ userId: 'u1' });
  assert.equal(after.points, before);
  assert.equal(after.weightLossPoints, 0);
  assert.equal(after.lastWeight, 190);
});

test('the hourly job recounts v2 with the engine and leaves Classic on Classic rules', async () => {
  const v2 = await seed('v2', { users: ['v'], rows: { v: { '-2': { steps: 12000 } } } });
  const classic = await seed('classic', { users: ['c'], rows: { c: { '-2': { steps: 12000 } } } });
  await internals.recalculateStepPoints();
  const pv = await ChallengeParticipant.findOne({ challengeId: v2._id.toString() });
  const pc = await ChallengeParticipant.findOne({ challengeId: classic._id.toString() });
  assert.equal(pv.points, 14); // 12 steps + 2 bonus
  assert.equal(pc.points, 1); // Classic: +1 per goal day
  assert.equal(pc.scoringMode, undefined);
  assert.equal(pc.totalPoints, undefined);
});

test('a manual weigh-in on a v2 challenge keeps the weight but not Classic points', async () => {
  const c = await seed('v2', { daysAgo: 14, rows: { u1: { '-2': { steps: 12000 } } } });
  await recountV2Challenge(c);
  const res = await fetch(`${app.base}/api/challenge/${c._id}/participant/u1/weight`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: 196 }),
  });
  assert.equal(res.status, 200);
  const p = await ChallengeParticipant.findOne({ userId: 'u1' });
  assert.equal(p.lastWeight, 196);
  assert.equal(p.points, 14);
});

test('weight loss uses weigh-in-day readings only, capped per week', async () => {
  // Find the most recent Monday on or before yesterday inside a 14-day-old challenge.
  let monday = -1;
  while (daysFromToday(monday).getDay() !== 1) monday--;
  const notMonday = monday === -1 ? -2 : monday + 1;
  const c = await seed('v2', { daysAgo: 14, rows: { u1: { [monday]: { weight: 197, source: 'manual' }, [notMonday]: { weight: 180, source: 'manual' } } } });
  const p = await ChallengeParticipant.findOne({ userId: 'u1' });
  const r = await scoreParticipant(c, p);
  assert.equal(r.weight.latestWeight, 197); // the Tuesday 180 is ignored
  assert.equal(r.categories.weightLoss, 30); // 1.5% lost, under the 3-week cap of 2.25%
  // The weight-only manual rows are "no step data", not zero-step days.
  assert.equal(r.days.find((d) => d.date === ymd(daysFromToday(monday))).steps, null);
});

test('finalize locks days older than 48h; synced writes to them are dropped', async () => {
  const c = await seed('v2', { rows: { u1: { '-4': { steps: 8000 }, '-3': { steps: 9000 }, '-2': { steps: 10000 }, '-1': { steps: null } } } });
  const n = await finalizeV2Days([c]);
  assert.equal(n, 2); // -4 and -3; -2 is under 48h old, -1 has no data
  await FitnessHistory.findOneAndUpdate({ userId: 'u1', date: daysFromToday(-3) }, { $set: { steps: 20000, weight: 199 } });
  const locked = await FitnessHistory.findOne({ userId: 'u1', date: daysFromToday(-3) });
  assert.equal(locked.steps, 9000);
  assert.equal(locked.weight, 199); // weight stays writable
  await FitnessHistory.findOneAndUpdate({ userId: 'u1', date: daysFromToday(-2) }, { $set: { steps: 10500 } });
  assert.equal((await FitnessHistory.findOne({ userId: 'u1', date: daysFromToday(-2) })).steps, 10500);
  // save() path is locked too
  locked.steps = 1;
  await locked.save();
  assert.equal((await FitnessHistory.findOne({ userId: 'u1', date: daysFromToday(-3) })).steps, 9000);
});

test('the v2 leaderboard matches the engine and ranks by total', async () => {
  const c = await seed('v2', { users: ['a', 'b'], rows: { a: { '-2': { steps: 7000 } }, b: { '-2': { steps: 12000, effortPoints: 30 } } } });
  const res = await fetch(`${app.base}/api/leaderboard/${c._id}`);
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.deepEqual(rows.map((r) => [r.userId, r.rank, r.totalPoints]), [['b', 1, 17], ['a', 2, 7]]);
  assert.deepEqual(rows[0].breakdown, { steps: 12, goalBonus: 2, effort: 3, strength: 0, weekly: 0, weightLoss: 0 });
  for (const row of rows) {
    const p = await ChallengeParticipant.findOne({ userId: row.userId });
    const engine = await scoreParticipant(c, p);
    assert.equal(row.totalPoints, engine.total);
  }
});

test('a Classic leaderboard response is unchanged in shape', async () => {
  const c = await seed('classic', { users: ['a'], rows: { a: { '-2': { steps: 12000 } } } });
  await internals.recalculateStepPoints();
  const rows = await (await fetch(`${app.base}/api/leaderboard/${c._id}`)).json();
  assert.equal(rows[0].points, 1);
  assert.equal(rows[0].breakdown, undefined);
  assert.equal(rows[0].scoringMode, undefined);
});

test('creating a challenge stores the chosen scoring mode, defaulting to classic', async () => {
  const make = async (extra) => {
    const res = await fetch(`${app.base}/api/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new', startDate: ymd(daysFromToday(1)), endDate: ymd(daysFromToday(30)), stepGoal: 10000, userGoogleId: 'creator', creatorEmail: 'c@example.com', userName: 'C', ...extra }),
    });
    return res;
  };
  const r1 = await make({ scoringMode: 'v2' });
  const r2 = await make({});
  const r3 = await make({ scoringMode: 'bogus' });
  assert.ok(r1.status < 300 && r2.status < 300 && r3.status < 300, `${r1.status} ${r2.status} ${r3.status}`);
  const modes = (await Challenge.find({ name: 'new' }).sort({ _id: 1 })).map((c) => c.scoringMode);
  assert.deepEqual(modes, ['v2', 'classic', 'classic']);
});
