const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { sign, startApp } = require('./helpers');
const { connectTestDb, resetTestDb, disconnectTestDb, daysFromToday, ymd } = require('./db');
const ghFixtures = require('./fixtures/google-health');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const FitnessHistory = require('../models/FitnessHistory');
const sourceLock = require('../services/health/sourceLock');
const v2Jobs = require('../services/scoring/v2Jobs');
const { recountV2Challenge } = require('../services/scoring/recountV2');

let app;
const realFetch = global.fetch;
const googleCalls = [];

function mockGoogle() {
  googleCalls.length = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes('googleapis.com')) return realFetch(url, opts);
    googleCalls.push(u);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('dailyRollUp')) return json(200, { rollupDataPoints: [] });
    if (u.includes('/revoke')) return json(200, {});
    if (u.includes('/dataTypes/')) return json(200, { dataPoints: [] });
    return json(404, {});
  };
}

before(async () => {
  process.env.GOOGLE_HEALTH_ENABLED = 'true';
  process.env.WHOOP_ENABLED = 'true';
  process.env.WHOOP_CLIENT_ID = 'whoop-client';
  await connectTestDb();
  app = await startApp();
});
after(async () => {
  global.fetch = realFetch;
  await app.close();
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  global.fetch = realFetch;
});

const auth = (googleId) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${sign(googleId)}` });

async function challenge(mode, { startOffset = -7, endOffset = 21, name = `${mode} challenge` } = {}) {
  return Challenge.create({
    name, scoringMode: mode, stepGoal: 10000, weighInDay: 'monday', participants: [], admin: 'admin',
    startDate: ymd(daysFromToday(startOffset)), endDate: ymd(daysFromToday(endOffset)),
  });
}
const join = (c, userId) => ChallengeParticipant.create({ challengeId: c._id.toString(), userId, startingWeight: 200 });

// --- locking on join -------------------------------------------------------------

test('joining a v2 challenge locks the current source; Classic challenges do not', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-health', oauthType: 'google', googleHealthRefreshToken: 'r' });
  const v2 = await join(await challenge('v2'), 'u1');
  assert.equal(v2.lockedSource, 'google-health');
  assert.equal(v2.scoringMode, 'v2');
  const classic = await join(await challenge('classic'), 'u1');
  assert.equal(classic.lockedSource, undefined);
  assert.equal(classic.scoringMode, undefined);
});

test('a v2 participant from before locking is locked on the next recount', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'whoop', whoopRefreshToken: 'r' });
  const c = await challenge('v2');
  await ChallengeParticipant.collection.insertOne({ challengeId: c._id.toString(), userId: 'u1', points: 0 });
  await recountV2Challenge(c);
  assert.equal((await ChallengeParticipant.findOne({ userId: 'u1' })).lockedSource, 'whoop');
});

test('only running or upcoming v2 challenges hold a lock', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-fit' });
  await join(await challenge('v2', { startOffset: -40, endOffset: -10, name: 'over' }), 'u1');
  await join(await challenge('v2', { startOffset: 5, endOffset: 30, name: 'upcoming' }), 'u1');
  const locks = await sourceLock.getActiveLocks('u1');
  assert.deepEqual(locks.map((l) => l.challengeName), ['upcoming']);
});

// --- switching -------------------------------------------------------------------

test('locked users cannot switch source, except legacy sources moving to Google Health', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-fit', googleHealthRefreshToken: 'r', whoopRefreshToken: 'w' });
  await join(await challenge('v2'), 'u1');
  const put = (dataSource) => fetch(`${app.base}/api/user/datasource`, { method: 'PUT', headers: auth('u1'), body: JSON.stringify({ googleId: 'u1', dataSource }) });

  const toWhoop = await put('whoop');
  assert.equal(toWhoop.status, 409);
  const body = await toWhoop.json();
  assert.equal(body.locked, true);
  assert.match(body.error, /locked to Google Fit/);

  assert.equal((await put('google-health')).status, 200, 'Google Fit may move to Google Health');
  assert.equal((await ChallengeParticipant.findOne({ userId: 'u1' })).lockedSource, 'google-health', 'lock moved');
  assert.equal((await put('google-fit')).status, 400, 'and cannot move back: Google Fit is no longer selectable');
});

test('PUT /datasource only changes the signed-in user', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-fit' });
  const res = await fetch(`${app.base}/api/user/datasource`, { method: 'PUT', headers: auth('someone-else'), body: JSON.stringify({ googleId: 'u1', dataSource: 'google-fit' }) });
  assert.equal(res.status, 403);
});

test('connect URLs refuse a source the user is not locked to', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-health', oauthType: 'google', googleHealthRefreshToken: 'r' });
  await join(await challenge('v2'), 'u1');
  const res = await fetch(`${app.base}/api/auth/whoop/url`, { headers: auth('u1') });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).locked, true);
  assert.equal((await User.findOne({ googleId: 'u1' })).whoopOAuthState, undefined, 'no consent started');
});

test('disconnecting the locked source needs confirmation and then stays on it, disconnected', async () => {
  mockGoogle();
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-health', oauthType: 'google', googleHealthRefreshToken: 'r', googleHealthAccessToken: 'a', googleHealthTokenExpiry: Date.now() + 3600e3, accessToken: 'google-fit-token' });
  await join(await challenge('v2'), 'u1');
  const disconnect = (body) => fetch(`${app.base}/api/auth/google-health/disconnect`, { method: 'POST', headers: auth('u1'), body: JSON.stringify(body) });

  const refused = await disconnect({});
  assert.equal(refused.status, 409);
  assert.equal((await User.findOne({ googleId: 'u1' })).googleHealthRefreshToken, 'r');

  assert.equal((await disconnect({ confirm: true })).status, 200);
  const u = await User.findOne({ googleId: 'u1' });
  assert.equal(u.dataSource, 'google-health');
  assert.equal(u.googleHealthRefreshToken, undefined);

  googleCalls.length = 0;
  const data = await (await fetch(`${app.base}/api/user/userdata?googleId=u1`, { headers: auth('u1') })).json();
  assert.equal(data.needsReconnect, true);
  assert.equal(data.dataSource, 'google-health');
  assert.ok(!googleCalls.some((c) => c.includes('fitness/v1')), 'did not fall back to Google Fit');

  const ds = await (await fetch(`${app.base}/api/user/datasource?googleId=u1`, { headers: auth('u1') })).json();
  assert.equal(ds.sourceLocks[0].lockedSource, 'google-health');
});

// --- jobs ------------------------------------------------------------------------

test('morning backfill pulls 3 days for v2 participants only, then finalizes and recounts', async () => {
  mockGoogle();
  await User.create({ googleId: 'gh', name: 'G', dataSource: 'google-health', oauthType: 'google', googleHealthRefreshToken: 'r', googleHealthAccessToken: 'a', googleHealthTokenExpiry: Date.now() + 3600e3 });
  await User.create({ googleId: 'gf', name: 'F', dataSource: 'google-fit', accessToken: 'x' });
  await User.create({ googleId: 'classic-only', name: 'C', dataSource: 'google-fit', accessToken: 'x' });
  const v2 = await challenge('v2');
  await join(v2, 'gh');
  await join(v2, 'gf');
  await join(await challenge('classic'), 'classic-only');
  await FitnessHistory.create({ userId: 'gf', date: daysFromToday(-5), steps: 8000, source: 'google-fit' });

  const googleFitSyncs = [];
  const r = await v2Jobs.morningBackfill({ deps: { syncGoogleFit: async (user, days) => googleFitSyncs.push([user.googleId, days]) } });

  assert.equal(r.challenges, 1);
  assert.equal(r.users, 2);
  assert.equal(r.synced, 2);
  assert.deepEqual(googleFitSyncs, [['gf', 3]]);
  const rollup = googleCalls.find((c) => c.includes('dailyRollUp'));
  assert.ok(rollup, 'Google Health user synced');
  assert.equal((await FitnessHistory.findOne({ userId: 'gf', date: daysFromToday(-5) })).finalized, true);
  assert.equal((await ChallengeParticipant.findOne({ userId: 'gf' })).totalPoints, 8);
});

test('finalize pass locks days 48h+ after they end, and only for running v2 challenges', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-fit' });
  await join(await challenge('v2'), 'u1');
  await FitnessHistory.create({ userId: 'u1', date: daysFromToday(-3), steps: 5000, source: 'google-fit' });
  await FitnessHistory.create({ userId: 'u1', date: daysFromToday(-2), steps: 5000, source: 'google-fit' });
  const r = await v2Jobs.finalizePass();
  assert.equal(r.finalized, 1);
  assert.equal((await FitnessHistory.findOne({ userId: 'u1', date: daysFromToday(-3) })).finalized, true);
  assert.notEqual((await FitnessHistory.findOne({ userId: 'u1', date: daysFromToday(-2) })).finalized, true);
});

// --- Google Fit and Fitbit retired as choices ---------------------------------------

test('Google Fit and Fitbit can no longer be chosen; Google Health and WHOOP can', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'none', googleHealthRefreshToken: 'r', whoopRefreshToken: 'w', accessToken: 'gf' });
  const put = (dataSource) => fetch(`${app.base}/api/user/datasource`, { method: 'PUT', headers: auth('u1'), body: JSON.stringify({ googleId: 'u1', dataSource }) });
  const gf = await put('google-fit');
  assert.equal(gf.status, 400);
  assert.match((await gf.json()).error, /Google Fit is no longer available/);
  assert.equal((await put('fitbit')).status, 400);
  assert.equal((await put('whoop')).status, 200);
});

test('a user with no source may connect either new source once when locked', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'none' });
  await join(await challenge('v2'), 'u1');
  assert.equal((await ChallengeParticipant.findOne({ userId: 'u1' })).lockedSource, 'none');
  assert.equal((await sourceLock.checkSwitch('u1', 'whoop')).ok, true);
  assert.equal((await sourceLock.checkSwitch('u1', 'google-health')).ok, true);
  await sourceLock.moveLocks('u1', 'whoop');
  assert.equal((await sourceLock.checkSwitch('u1', 'google-health')).ok, false, 'then locked to WHOOP');
});

test('no-source users: no browser steps, no Google Fit fallback, prompted to connect', async () => {
  mockGoogle();
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'none', accessToken: 'stale' });
  const post = await fetch(`${app.base}/api/user/userdata`, { method: 'POST', headers: auth('u1'), body: JSON.stringify({ googleId: 'u1', steps: 5000 }) });
  assert.equal(post.status, 409);
  const data = await (await fetch(`${app.base}/api/user/userdata?googleId=u1`, { headers: auth('u1') })).json();
  assert.equal(data.dataSource, 'none');
  assert.equal(data.needsReconnect, true);
  assert.equal(googleCalls.length, 0, 'no Google Fit calls');
  const ds = await (await fetch(`${app.base}/api/user/datasource?googleId=u1`, { headers: auth('u1') })).json();
  assert.equal(ds.shouldSwitchSource, true);
});

test('existing Google Fit users keep browser-pushed steps and are told to switch', async () => {
  await User.create({ googleId: 'u1', name: 'A', dataSource: 'google-fit' });
  const ds = await (await fetch(`${app.base}/api/user/datasource?googleId=u1`, { headers: auth('u1') })).json();
  assert.equal(ds.shouldSwitchSource, true);
  assert.equal(ds.needsReconnect, false);
  const post = await fetch(`${app.base}/api/user/userdata`, { method: 'POST', headers: auth('u1'), body: JSON.stringify({ googleId: 'u1', steps: 5000 }) });
  assert.notEqual(post.status, 409);
});

test('sign-in asks only for name, email and picture; Fitbit connect is gone', async () => {
  const signIn = await fetch(`${app.base}/api/auth/google`, { redirect: 'manual' });
  assert.equal(signIn.status, 302);
  const scope = new URL(signIn.headers.get('location')).searchParams.get('scope');
  assert.deepEqual(scope.split(' ').sort(), ['email', 'openid', 'profile']);
  const fitbit = await fetch(`${app.base}/api/auth/fitbit?googleId=u1`, { redirect: 'manual' });
  assert.equal(fitbit.status, 302);
  assert.match(fitbit.headers.get('location'), /data-source-settings\?error=Fitbit/);
});
