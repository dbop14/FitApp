const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { sign, startApp } = require('./helpers');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./db');
const fixtures = require('./fixtures/whoop');
const User = require('../models/User');
const FitnessHistory = require('../models/FitnessHistory');
const whoop = require('../services/health/whoop');
const health = require('../services/health');
const whoopAuth = require('../utils/whoopAuth');

let app;
const realFetch = global.fetch;
const calls = [];

// Route WHOOP calls to fixtures; everything else (our own test server) is real.
function mockWhoop({ tokenScope, failProfile, refreshDelayMs = 0 } = {}) {
  calls.length = 0;
  let refreshCount = 0;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname !== 'api.prod.whoop.com') return realFetch(url, opts);
    calls.push({ url: String(url), method: opts.method || 'GET', auth: opts.headers?.Authorization, body: opts.body ? String(opts.body) : '' });
    const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/oauth/oauth2/token') {
      const params = new URLSearchParams(String(opts.body));
      if (params.get('grant_type') === 'refresh_token') {
        refreshCount++;
        if (params.get('refresh_token') === 'dead') return json(400, { error: 'invalid_grant' });
        await new Promise((r) => setTimeout(r, refreshDelayMs));
        return json(200, { access_token: `wh-access-${refreshCount}`, refresh_token: `wh-refresh-${refreshCount}`, expires_in: 3600, scope: 'offline' });
      }
      return json(200, {
        access_token: 'wh-access', refresh_token: 'wh-refresh', expires_in: 3600,
        scope: tokenScope ?? 'read:cycles read:workout read:body_measurement read:profile offline',
      });
    }
    if (u.pathname === '/developer/v2/cycle') {
      return json(200, u.searchParams.get('nextToken') === 'page2' ? fixtures.cyclesPage2 : fixtures.cyclesPage1);
    }
    if (u.pathname === '/developer/v2/activity/workout') return json(200, fixtures.workouts);
    if (u.pathname === '/developer/v2/user/profile/basic') return failProfile ? json(401, { error: 'unauthorized' }) : json(200, fixtures.profile);
    if (u.pathname === '/developer/v2/user/access' && opts.method === 'DELETE') return json(204);
    return json(404, {});
  };
}

before(async () => {
  process.env.WHOOP_ENABLED = 'true';
  process.env.WHOOP_CLIENT_ID = 'whoop-client';
  process.env.WHOOP_CLIENT_SECRET = 'whoop-secret';
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
  process.env.WHOOP_ENABLED = 'true';
});

const ymd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const connectedUser = (extra = {}) => User.create({
  googleId: 'wh-user', name: 'T', dataSource: 'whoop',
  whoopAccessToken: 'wh-access', whoopRefreshToken: 'wh-refresh', whoopTokenExpiry: Date.now() + 3600e3, ...extra,
});

// --- parsing -----------------------------------------------------------------

test('steps: each cycle credited to its local start day, same-day cycles summed, missing days null', () => {
  const days = whoop.parseDailySteps([...fixtures.cyclesPage1.records, ...fixtures.cyclesPage2.records], '2026-11-06', '2026-11-09');
  assert.deepEqual(days, [
    { date: '2026-11-06', steps: null }, // cycle without step_count
    { date: '2026-11-07', steps: 12000 }, // 11250 (started 23:40 local) + 750
    { date: '2026-11-08', steps: null },
    { date: '2026-11-09', steps: 4100 }, // open cycle, steps so far
  ]);
});

test('workouts: zones 1-2 moderate, 3-5 vigorous; sport table; strength 20+ min; unscored and short count 0', () => {
  const w = whoop.parseWorkouts(fixtures.workouts.records, '2026-11-07', '2026-11-09');
  const byId = Object.fromEntries(w.map((x, i) => [fixtures.workouts.records.find((r) => r.start === x.start).id, x]));
  assert.equal(byId['w-run'].moderateMinutes, 25);
  assert.equal(byId['w-run'].vigorousMinutes, 17);
  assert.equal(byId['w-run'].effortPoints, 59);
  assert.equal(byId['w-run'].isStrength, false);
  assert.equal(byId['w-lift'].date, '2026-11-08', '20:30 local, not the UTC date');
  assert.equal(byId['w-lift'].category, 'strength');
  assert.equal(byId['w-lift'].isStrength, true);
  assert.equal(byId['w-lift'].effortPoints, 23 + 2 * 2);
  assert.equal(byId['w-work'].category, 'excluded');
  assert.equal(byId['w-work'].effortPoints, 0);
  assert.equal(byId['w-pending'].scored, false);
  assert.equal(byId['w-pending'].effortPoints, 0);
  assert.equal(byId['w-walk'].effortPoints, 0);
});

test('UTC offsets parse in every WHOOP form', () => {
  assert.equal(whoop.offsetMinutes('-05:00'), -300);
  assert.equal(whoop.offsetMinutes('+0530'), 330);
  assert.equal(whoop.offsetMinutes('Z'), 0);
  assert.equal(whoop.localDate('2026-11-09T01:30:00.000Z', '-05:00'), '2026-11-08');
});

test('WHOOP weight is ignored', async () => {
  assert.deepEqual(await whoop.getWeights(), []);
});

// --- routing and sync ------------------------------------------------------------

test('HealthSource routing: WHOOP adapter only when enabled and connected', async () => {
  assert.equal(health.getHealthSource({ dataSource: 'whoop', whoopRefreshToken: 'x' }).name, 'whoop');
  assert.equal(health.getHealthSource({ dataSource: 'whoop' }), null, 'not connected');
  process.env.WHOOP_ENABLED = 'false';
  assert.equal(health.getHealthSource({ dataSource: 'whoop', whoopRefreshToken: 'x' }), null);
  process.env.WHOOP_ENABLED = 'true';
  assert.equal(health.needsReconnect({ dataSource: 'whoop', whoopLastError: 'invalid_grant' }), true);
  assert.equal(health.needsReconnect({ dataSource: 'whoop', whoopRefreshToken: 'x' }), false);
  assert.equal(health.needsReconnect({ dataSource: 'whoop' }), true, 'disconnected');
});

test('sync pages through cycles and writes steps, effort and strength per day; weight untouched', async () => {
  mockWhoop();
  const user = await connectedUser();
  await FitnessHistory.create({ userId: 'wh-user', date: ymd('2026-11-08'), steps: 0, weight: 194, source: 'manual' });

  await health.syncHealthHistory(user, { days: 3, now: new Date('2026-11-09T20:00:00Z') });

  const rows = Object.fromEntries((await FitnessHistory.find({ userId: 'wh-user' }).lean()).map((r) => [health.todayYmd(r.date), r]));
  assert.equal(rows['2026-11-07'].steps, 12000);
  assert.equal(rows['2026-11-07'].effortPoints, 59);
  assert.equal(rows['2026-11-07'].source, 'whoop');
  assert.equal(rows['2026-11-08'].weight, 194, 'manual weigh-in kept');
  assert.equal(rows['2026-11-08'].strengthSessions, 1);
  assert.equal(rows['2026-11-08'].effortPoints, 27);
  assert.equal(rows['2026-11-09'].steps, 4100);
  assert.equal(rows['2026-11-09'].effortPoints, 0);
  const cycleCalls = calls.filter((c) => c.url.includes('/v2/cycle'));
  assert.equal(cycleCalls.length, 2, 'followed next_token');
  assert.ok(cycleCalls.every((c) => new URL(c.url).searchParams.get('limit') === '25'));
  assert.ok(calls.filter((c) => c.url.includes('/developer/')).every((c) => c.auth === 'Bearer wh-access'));
  assert.ok(!calls.some((c) => /sleep|recovery|measurement/.test(c.url)), 'no sleep, recovery or body reads');
  assert.equal((await User.findOne({ googleId: 'wh-user' })).weight, undefined, 'WHOOP weight not used');
});

// --- tokens ----------------------------------------------------------------------

test('refresh saves the rotated refresh token, and concurrent refreshes make one request', async () => {
  mockWhoop({ refreshDelayMs: 50 });
  const user = await connectedUser({ whoopTokenExpiry: Date.now() - 1000 });
  const [a, b] = await Promise.all([whoopAuth.ensureValidWhoopToken(user), whoopAuth.ensureValidWhoopToken(user)]);
  assert.equal(a, 'wh-access-1');
  assert.equal(b, 'wh-access-1');
  assert.equal(calls.filter((c) => c.url.includes('/oauth2/token')).length, 1);
  assert.match(calls[0].body, /scope=offline/);
  const saved = await User.findOne({ googleId: 'wh-user' });
  assert.equal(saved.whoopRefreshToken, 'wh-refresh-1');
});

test('a dead refresh token marks the user for reconnect', async () => {
  mockWhoop();
  const user = await connectedUser({ whoopTokenExpiry: Date.now() - 1000, whoopRefreshToken: 'dead' });
  await assert.rejects(whoopAuth.ensureValidWhoopToken(user));
  const saved = await User.findOne({ googleId: 'wh-user' });
  assert.equal(saved.whoopLastError, 'invalid_grant');
  assert.equal(health.needsReconnect(saved), true);
});

// --- connect flow ------------------------------------------------------------------

async function startConnect(googleId = 'wh-user') {
  const res = await fetch(`${app.base}/api/auth/whoop/url`, { headers: { Authorization: `Bearer ${sign(googleId)}` } });
  assert.equal(res.status, 200);
  return new URL((await res.json()).url);
}
const callback = (params) => fetch(`${app.base}/api/auth/whoop/callback?${new URLSearchParams(params)}`, { redirect: 'manual' });

test('consent URL needs sign-in, uses an 8-character state, and asks for no sleep or recovery', async () => {
  assert.equal((await fetch(`${app.base}/api/auth/whoop/url`)).status, 401);
  await User.create({ googleId: 'wh-user', name: 'T' });
  const url = await startConnect();
  assert.equal(url.origin + url.pathname, 'https://api.prod.whoop.com/oauth/oauth2/auth');
  assert.match(url.searchParams.get('state'), /^[A-Za-z0-9]{8}$/);
  assert.equal(url.searchParams.get('scope'), 'read:cycles read:workout read:body_measurement read:profile offline');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://fitappdevbackend.herringm.com/api/auth/whoop/callback');
  process.env.WHOOP_ENABLED = 'false';
  const off = await fetch(`${app.base}/api/auth/whoop/url`, { headers: { Authorization: `Bearer ${sign('wh-user')}` } });
  assert.equal(off.status, 404);
});

test('callback connects WHOOP, makes it the active source, and the state works once', async () => {
  mockWhoop();
  await User.create({ googleId: 'wh-user', name: 'T', dataSource: 'google-fit', fitbitAccessToken: 'old' });
  const state = (await startConnect()).searchParams.get('state');
  const res = await callback({ code: 'abc', state });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /data-source-settings\?whoop=connected$/);
  const u = await User.findOne({ googleId: 'wh-user' });
  assert.equal(u.dataSource, 'whoop');
  assert.equal(u.whoopRefreshToken, 'wh-refresh');
  assert.equal(u.whoopUserId, '10129');
  assert.equal(u.fitbitAccessToken, undefined);
  assert.equal(u.whoopOAuthState, undefined);
  const again = await callback({ code: 'abc', state });
  assert.match(again.headers.get('location'), /whoop=error&reason=expired/);
});

test('callback rejects an unknown state and a grant missing a scope', async () => {
  mockWhoop({ tokenScope: 'read:cycles read:profile offline' });
  assert.match((await callback({ code: 'abc', state: 'ABCDEFGH' })).headers.get('location'), /reason=expired/);
  await User.create({ googleId: 'wh-user', name: 'T', dataSource: 'google-fit' });
  const state = (await startConnect()).searchParams.get('state');
  assert.match((await callback({ code: 'abc', state })).headers.get('location'), /reason=scopes/);
  const u = await User.findOne({ googleId: 'wh-user' });
  assert.equal(u.dataSource, 'google-fit');
  assert.equal(u.whoopRefreshToken, undefined);
});

test('callback keeps the old setup when the test read fails', async () => {
  mockWhoop({ failProfile: true });
  await User.create({ googleId: 'wh-user', name: 'T', dataSource: 'google-health', googleHealthRefreshToken: 'gh' });
  const state = (await startConnect()).searchParams.get('state');
  assert.match((await callback({ code: 'abc', state })).headers.get('location'), /whoop=error/);
  const u = await User.findOne({ googleId: 'wh-user' });
  assert.equal(u.dataSource, 'google-health');
  assert.equal(u.whoopRefreshToken, undefined);
});

test('disconnect revokes access and falls back to Google Health when connected', async () => {
  mockWhoop();
  await connectedUser({ googleHealthRefreshToken: 'gh' });
  const res = await fetch(`${app.base}/api/auth/whoop/disconnect`, { method: 'POST', headers: { Authorization: `Bearer ${sign('wh-user')}` } });
  assert.equal((await res.json()).dataSource, 'google-health');
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/v2/user/access')));
  const u = await User.findOne({ googleId: 'wh-user' });
  assert.equal(u.whoopRefreshToken, undefined);
});

test('browser-pushed steps are refused for a WHOOP user; datasource lists WHOOP', async () => {
  await connectedUser();
  const post = await fetch(`${app.base}/api/user/userdata`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sign('wh-user')}` },
    body: JSON.stringify({ googleId: 'wh-user', steps: 5000 }),
  });
  assert.equal(post.status, 409);
  const ds = await (await fetch(`${app.base}/api/user/datasource?googleId=wh-user`, { headers: { Authorization: `Bearer ${sign('wh-user')}` } })).json();
  assert.equal(ds.whoopEnabled, true);
  assert.equal(ds.whoopConnected, true);
  const put = await fetch(`${app.base}/api/user/datasource`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sign('wh-user')}` },
    body: JSON.stringify({ googleId: 'wh-user', dataSource: 'whoop' }),
  });
  assert.equal(put.status, 200);
});
