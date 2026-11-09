const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { sign, startApp } = require('./helpers');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./db');
const fixtures = require('./fixtures/google-health');
const User = require('../models/User');
const FitnessHistory = require('../models/FitnessHistory');
const googleHealth = require('../services/health/googleHealth');
const health = require('../services/health');
const { signState } = require('../utils/googleHealthAuth');

let app;
const realFetch = global.fetch;
const calls = [];

// Route Google calls to fixtures; everything else (our own test server) is real.
function mockGoogle({ tokenScope, failSteps } = {}) {
  calls.length = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes('googleapis.com')) return realFetch(url, opts);
    calls.push({ url: u, method: opts.method || 'GET', auth: opts.headers?.Authorization });
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      return json(200, { access_token: 'gh-access', refresh_token: 'gh-refresh', expires_in: 3600, scope: tokenScope ?? require('../config/healthSources').GOOGLE_HEALTH_SCOPES.join(' ') });
    }
    if (u.includes('/dataTypes/steps/dataPoints:dailyRollUp')) {
      if (failSteps) return json(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: failSteps }] } });
      return json(200, fixtures.steps);
    }
    if (u.includes('/dataTypes/weight/dataPoints')) return json(200, fixtures.weight);
    if (u.includes('/dataTypes/exercise/dataPoints')) return json(200, fixtures.exercise);
    return json(404, {});
  };
}

before(async () => {
  process.env.GOOGLE_HEALTH_ENABLED = 'true';
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://fitappdevbackend.herringm.com/api/auth/google/callback';
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

const connectedUser = () => User.create({
  googleId: 'gh-user', name: 'T', dataSource: 'google-health', oauthType: 'google',
  googleHealthAccessToken: 'gh-access', googleHealthRefreshToken: 'gh-refresh', googleHealthTokenExpiry: Date.now() + 3600e3,
});

// --- parsing -----------------------------------------------------------------

test('daily steps: missing days are null (no data), not zero', () => {
  const days = googleHealth.parseDailySteps(fixtures.steps, '2026-11-07', '2026-11-09');
  assert.deepEqual(days, [
    { date: '2026-11-07', steps: 11250 },
    { date: '2026-11-08', steps: 4321 },
    { date: '2026-11-09', steps: null },
  ]);
});

test('weights: grams to lbs, dated in APP_TIMEZONE, oldest first', () => {
  const w = googleHealth.parseWeights(fixtures.weight.dataPoints, '2026-11-01', '2026-11-09');
  assert.deepEqual(w.map((x) => [x.date, x.weightLbs]), [['2026-11-07', 196], ['2026-11-08', 195]]);
});

test('workouts: zones give effort (1x moderate, 2x vigorous+peak), 10-minute minimum, strength needs 20 minutes', () => {
  const w = googleHealth.parseWorkouts(fixtures.exercise.dataPoints, '2026-11-01', '2026-11-09');
  const byType = Object.fromEntries(w.map((x) => [x.type, x]));
  assert.equal(byType.RUNNING.moderateMinutes, 20);
  assert.equal(byType.RUNNING.vigorousMinutes, 17);
  assert.equal(byType.RUNNING.effortPoints, 54);
  assert.equal(byType.RUNNING.isStrength, false);
  assert.equal(byType.WEIGHTLIFTING.effortPoints, 12); // activeZoneMinutes fallback
  assert.equal(byType.WEIGHTLIFTING.isStrength, true);
  assert.equal(byType.WEIGHTLIFTING.date, '2026-11-08'); // 17:00 New York
  assert.equal(byType.WALKING.effortPoints, 0);
  assert.equal(byType.STRENGTH_TRAINING.effortPoints, 10);
  assert.equal(byType.STRENGTH_TRAINING.isStrength, false);
});

test('durations parse from "123s", "1.5s" and {seconds}', () => {
  assert.equal(googleHealth.durationSeconds('123s'), 123);
  assert.equal(googleHealth.durationSeconds('1.5s'), 1.5);
  assert.equal(googleHealth.durationSeconds({ seconds: '60', nanos: 500000000 }), 60.5);
  assert.equal(googleHealth.durationSeconds(undefined), 0);
});

// --- source routing ------------------------------------------------------------

test('HealthSource routing: only connected google-health users use the adapter, and only when enabled', () => {
  assert.equal(health.getHealthSource({ dataSource: 'google-fit' }), null);
  assert.equal(health.getHealthSource({ dataSource: 'fitbit' }), null);
  assert.equal(health.getHealthSource({ dataSource: 'google-health', oauthType: 'google' }).name, 'google-health');
  process.env.GOOGLE_HEALTH_ENABLED = 'false';
  assert.equal(health.getHealthSource({ dataSource: 'google-health', oauthType: 'google' }), null);
  process.env.GOOGLE_HEALTH_ENABLED = 'true';
  assert.equal(health.needsReconnect({ dataSource: 'fitbit' }), true);
  assert.equal(health.needsReconnect({ dataSource: 'google-fit' }), false);
  assert.equal(health.needsReconnect({ dataSource: 'google-health', oauthType: 'google', googleHealthLastError: 'invalid_grant' }), true);
});

// --- sync ----------------------------------------------------------------------

test('sync writes steps, weight, effort and strength per day; keeps manual weigh-ins and locked days', async () => {
  mockGoogle();
  const user = await connectedUser();
  const ymd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  await FitnessHistory.create({ userId: 'gh-user', date: ymd('2026-11-08'), steps: 0, weight: 194, source: 'manual' });
  await FitnessHistory.create({ userId: 'gh-user', date: ymd('2026-11-07'), steps: 9999, source: 'sync', finalized: true });

  await health.syncHealthHistory(user, { days: 3, now: new Date('2026-11-09T20:00:00Z') });

  const rows = Object.fromEntries((await FitnessHistory.find({ userId: 'gh-user' }).lean()).map((r) => [health.todayYmd(r.date), r]));
  assert.equal(rows['2026-11-07'].steps, 9999, 'finalized day keeps its steps');
  assert.equal(rows['2026-11-07'].weight, 196, 'weight still lands on a finalized day');
  assert.equal(rows['2026-11-08'].steps, 4321);
  assert.equal(rows['2026-11-08'].weight, 194, 'manual weigh-in wins');
  assert.equal(rows['2026-11-08'].source, 'manual');
  assert.equal(rows['2026-11-08'].strengthSessions, 1);
  assert.equal(rows['2026-11-08'].effortPoints, 12);
  assert.equal(rows['2026-11-09'].steps, null, 'no step data yet is stored as null, not 0');
  assert.equal(rows['2026-11-09'].effortPoints, 10);
  assert.equal(rows['2026-11-09'].source, 'google-health');
  assert.ok(calls.every((c) => c.auth === 'Bearer gh-access'));
});

test('GET /api/user/userdata syncs a Google Health user server-side', async () => {
  mockGoogle();
  await connectedUser();
  const res = await fetch(`${app.base}/api/user/userdata?googleId=gh-user`, { headers: { Authorization: `Bearer ${sign('gh-user')}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.dataSource, 'google-health');
  assert.equal(body.needsReconnect, false);
  assert.ok(calls.some((c) => c.url.includes('dailyRollUp')));
});

test('browser-pushed Google Fit steps are refused for a Google Health user', async () => {
  await connectedUser();
  const res = await fetch(`${app.base}/api/user/userdata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sign('gh-user')}` },
    body: JSON.stringify({ googleId: 'gh-user', steps: 50000 }),
  });
  assert.equal(res.status, 409);
});

// --- connect flow ------------------------------------------------------------------

test('consent URL needs sign-in and asks only for activity and body scopes, no sleep', async () => {
  assert.equal((await fetch(`${app.base}/api/auth/google-health/url`)).status, 401);
  const res = await fetch(`${app.base}/api/auth/google-health/url`, { headers: { Authorization: `Bearer ${sign('gh-user')}` } });
  assert.equal(res.status, 200);
  const url = new URL((await res.json()).url);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://fitappdevbackend.herringm.com/api/auth/google-health/callback');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  const scopes = url.searchParams.get('scope').split(' ');
  assert.equal(scopes.length, 2);
  assert.ok(scopes.every((s) => s.includes('googlehealth.') && s.endsWith('.readonly')));
  assert.ok(!scopes.some((s) => s.includes('sleep')));
});

test('consent URL is hidden when the flag is off', async () => {
  process.env.GOOGLE_HEALTH_ENABLED = 'false';
  const res = await fetch(`${app.base}/api/auth/google-health/url`, { headers: { Authorization: `Bearer ${sign('gh-user')}` } });
  process.env.GOOGLE_HEALTH_ENABLED = 'true';
  assert.equal(res.status, 404);
});

const callback = (qs) => fetch(`${app.base}/api/auth/google-health/callback?${new URLSearchParams(qs)}`, { redirect: 'manual' });
const reason = (res) => new URL(res.headers.get('location')).searchParams;

test('callback rejects a forged or missing state', async () => {
  const res = await callback({ code: 'x', state: 'not-a-token' });
  assert.equal(res.status, 302);
  assert.equal(reason(res).get('reason'), 'expired');
});

test('callback cuts a Fitbit user over to Google Health and clears legacy tokens', async () => {
  mockGoogle();
  await User.create({ googleId: 'fb-user', name: 'F', dataSource: 'fitbit', fitbitAccessToken: 'old', fitbitRefreshToken: 'old' });
  const res = await callback({ code: 'auth-code', state: signState('fb-user') });
  assert.equal(reason(res).get('googleHealth'), 'connected');
  const u = await User.findOne({ googleId: 'fb-user' });
  assert.equal(u.dataSource, 'google-health');
  assert.equal(u.oauthType, 'google');
  assert.equal(u.fitbitAccessToken, undefined);
  assert.equal(u.fitbitRefreshToken, undefined);
  assert.equal(u.googleHealthRefreshToken, 'gh-refresh');
});

test('callback keeps the old connection when the account is not linked (legacy Fitbit login)', async () => {
  mockGoogle({ failSteps: 'ACCOUNT_NOT_LINKED' });
  await User.create({ googleId: 'fb-user', name: 'F', dataSource: 'fitbit', fitbitAccessToken: 'old' });
  const res = await callback({ code: 'auth-code', state: signState('fb-user') });
  assert.equal(reason(res).get('reason'), 'ACCOUNT_NOT_LINKED');
  const u = await User.findOne({ googleId: 'fb-user' });
  assert.equal(u.dataSource, 'fitbit');
  assert.equal(u.fitbitAccessToken, 'old');
  assert.equal(u.googleHealthRefreshToken, undefined);
});

test('callback refuses a grant missing a scope', async () => {
  mockGoogle({ tokenScope: 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly' });
  await User.create({ googleId: 'u', name: 'U' });
  const res = await callback({ code: 'auth-code', state: signState('u') });
  assert.equal(reason(res).get('reason'), 'scopes');
  assert.equal((await User.findOne({ googleId: 'u' })).dataSource, 'google-fit');
});
