const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { sign, startApp } = require('./helpers');
const User = require('../models/User');

const ADMIN_AND_DEBUG = [
  ['POST', '/api/debug-log'],
  ['GET', '/api/test-env'],
  ['GET', '/api/test-google-fit/someone'],
  ['GET', '/api/debug/user/someone'],
  ['POST', '/api/admin/add-yesterday-step-point'],
  ['GET', '/api/admin/check-user-status/someone@example.com'],
  ['GET', '/api/admin/debug-stuck-user'],
  ['POST', '/api/admin/fix-stuck-user'],
  ['POST', '/api/admin/add-today-step-point'],
  ['POST', '/api/admin/fix-session-contamination'],
  ['POST', '/api/admin/force-remove-from-test-leaderboard'],
  ['DELETE', '/api/admin/delete-all-challenges'],
  ['POST', '/api/admin/fix-weight-date'],
  ['POST', '/api/admin/add-historical-weight'],
  ['POST', '/api/admin/update-starting-weight'],
];

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

const call = (method, path, headers = {}, body) =>
  fetch(app.base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

for (const [method, path] of ADMIN_AND_DEBUG) {
  test(`${method} ${path} rejects anonymous, non-admin and bot callers`, async () => {
    assert.equal((await call(method, path)).status, 401);
    const user = await call(method, path, { Authorization: `Bearer ${sign('regular-user')}` });
    assert.equal(user.status, 403);
    const bot = await call(method, path, { 'x-bot-secret': process.env.BOT_PASSWORD });
    assert.equal(bot.status, 403);
  });
}

test('an admin can reach an admin-only endpoint', async () => {
  const res = await call('GET', '/api/test-env', { Authorization: `Bearer ${sign('admin-google-id')}` });
  assert.equal(res.status, 200);
});

test('a token signed with another secret is refused', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ googleId: 'admin-google-id' }, 'your_jwt_secret');
  assert.equal((await call('GET', '/api/test-env', { Authorization: `Bearer ${forged}` })).status, 403);
});

test('refresh-google-fit-token needs a JWT for the same user', async () => {
  assert.equal((await call('GET', '/api/auth/refresh-google-fit-token/victim')).status, 401);
  const other = await call('GET', '/api/auth/refresh-google-fit-token/victim', { Authorization: `Bearer ${sign('attacker')}` });
  assert.equal(other.status, 403);
});

test('POST /api/auth/token no longer mints a token from a bare googleId', async () => {
  const res = await call('POST', '/api/auth/token', {}, { googleId: 'victim' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/token refuses a token for a different user', async () => {
  const res = await call('POST', '/api/auth/token', { Authorization: `Bearer ${sign('attacker')}` }, { googleId: 'victim' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/token refuses a token older than 30 days', async () => {
  const iat = Math.floor(Date.now() / 1000) - 31 * 24 * 3600;
  const old = sign('user-1', { iat, expiresIn: '7d' });
  const res = await call('POST', '/api/auth/token', { Authorization: `Bearer ${old}` }, { googleId: 'user-1' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/token re-issues for an expired token of the same user', async (t) => {
  const iat = Math.floor(Date.now() / 1000) - 10 * 24 * 3600;
  const expired = sign('user-1', { iat, expiresIn: '7d' });
  const original = User.findOne;
  User.findOne = async () => ({ googleId: 'user-1', name: 'Test', email: '' });
  t.after(() => { User.findOne = original; });
  const res = await call('POST', '/api/auth/token', { Authorization: `Bearer ${expired}` }, { googleId: 'user-1' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token);
});

test('save-user (steps, weight, OAuth tokens) is only for the signed-in user', async () => {
  const body = { googleId: 'victim', steps: 99999, refreshToken: 'x' };
  assert.equal((await call('POST', '/api/save-user', {}, body)).status, 401);
  const res = await call('POST', '/api/save-user', { Authorization: `Bearer ${sign('attacker')}` }, body);
  assert.equal(res.status, 403);
});

test("POST /api/user/userdata refuses writes to another user's steps", async () => {
  const res = await call('POST', '/api/user/userdata', { Authorization: `Bearer ${sign('attacker')}` }, { googleId: 'victim', steps: 99999 });
  assert.equal(res.status, 403);
});
