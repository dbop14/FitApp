// Pins Classic scoring as it behaved before Points v2. Do not edit these
// expectations to make a change pass: Classic must keep working exactly as is.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { connectTestDb, resetTestDb, disconnectTestDb, daysFromToday, ymd } = require('./db');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const FitnessHistory = require('../models/FitnessHistory');
const { recalcStepPointsForParticipant } = require('../scripts/backfillStepHistoryAndPoints');

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

async function seedClassic({ stepGoal = '10000', weightLossPoints = 0, startingWeight = 200, steps = [] } = {}) {
  const challenge = await Challenge.create({
    name: 'Classic test',
    startDate: ymd(daysFromToday(-steps.length)),
    endDate: ymd(daysFromToday(20)),
    stepGoal,
    weighInDay: 'monday',
    participants: ['user-a'],
    admin: 'user-a',
  });
  const participant = await ChallengeParticipant.create({
    challengeId: challenge._id.toString(),
    userId: 'user-a',
    startingWeight,
    weightLossPoints,
    points: weightLossPoints,
  });
  // One history row per day, oldest first, ending yesterday.
  for (let i = 0; i < steps.length; i++) {
    if (steps[i] === undefined) continue;
    await FitnessHistory.create({ userId: 'user-a', date: daysFromToday(i - steps.length), steps: steps[i] });
  }
  return { challenge, participant };
}

test('weight-loss rounding: .5 rounds up, below .5 rounds down, never negative', () => {
  const r = internals.roundWeightLossPoints;
  assert.equal(r(2.5), 3);
  assert.equal(r(2.49), 2);
  assert.equal(r(0), 0);
  assert.equal(r(-3.7), 0);
  assert.equal(r(7.0), 7);
});

test('hourly :05 recount: +1 per day at or above stepGoal, plus weight-loss points', async () => {
  const { participant } = await seedClassic({
    stepGoal: '10000', // stored as a string in older challenges
    weightLossPoints: 2,
    steps: [12000, 9999, 10000, 0, 15000],
  });
  // History from another user and from before the challenge must not count.
  await FitnessHistory.create({ userId: 'user-b', date: daysFromToday(-2), steps: 50000 });
  await FitnessHistory.create({ userId: 'user-a', date: daysFromToday(-30), steps: 50000 });

  await internals.recalculateStepPoints();

  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.stepGoalPoints, 3);
  assert.equal(p.stepGoalDaysAchieved, 3);
  assert.equal(p.weightLossPoints, 2);
  assert.equal(p.points, 5);
  assert.equal(p.lastStepDate.getTime(), daysFromToday(-1).getTime());
  assert.equal(p.lastStepCount, 15000);
});

test('hourly :05 recount uses the challenge stepGoal', async () => {
  const { participant } = await seedClassic({ stepGoal: 8000, steps: [8000, 7999, 9000] });
  await internals.recalculateStepPoints();
  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.points, 2);
});

test('23:55 backfill recount: step days plus % of starting weight lost, rounded', async () => {
  const { challenge, participant } = await seedClassic({ startingWeight: 200, steps: [11000, 3000, 10500] });
  // Latest weight reading anywhere in history: 190.5 lbs = 4.75% lost -> 5 points.
  await FitnessHistory.findOneAndUpdate({ userId: 'user-a', date: daysFromToday(-1) }, { weight: 190.5 });
  await FitnessHistory.create({ userId: 'user-a', date: daysFromToday(-3), weight: 199 });

  await recalcStepPointsForParticipant(participant, challenge);

  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.stepGoalPoints, 2);
  assert.equal(p.weightLossPoints, 5);
  assert.equal(p.points, 7);
});

test('23:55 backfill recount: weight gain scores 0', async () => {
  const { challenge, participant } = await seedClassic({ startingWeight: 200, steps: [12000] });
  await FitnessHistory.findOneAndUpdate({ userId: 'user-a', date: daysFromToday(-1) }, { weight: 205 });
  await recalcStepPointsForParticipant(participant, challenge);
  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.weightLossPoints, 0);
  assert.equal(p.points, 1);
});

test('manual weigh-in: points = step points + rounded % of starting weight lost', async () => {
  // Started two weeks ago, so this is not the first weigh-in (which would reset startingWeight).
  const { challenge, participant } = await seedClassic({ startingWeight: 200, steps: new Array(14) });
  await ChallengeParticipant.updateOne({ _id: participant._id }, { stepGoalPoints: 4 });

  const res = await fetch(`${app.base}/api/challenge/${challenge._id}/participant/user-a/weight`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: 195 }), // 2.5% lost -> 3 points
  });
  assert.equal(res.status, 200);
  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.weightLossPoints, 3);
  assert.equal(p.points, 7);
  assert.equal(p.lastWeight, 195);
});

test('manual weigh-in at the start of a challenge sets startingWeight and scores 0', async () => {
  const { challenge, participant } = await seedClassic({ startingWeight: null, steps: [] });
  const res = await fetch(`${app.base}/api/challenge/${challenge._id}/participant/user-a/weight`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: 210 }),
  });
  assert.equal(res.status, 200);
  const p = await ChallengeParticipant.findById(participant._id);
  assert.equal(p.startingWeight, 210);
  assert.equal(p.weightLossPoints, 0);
});
