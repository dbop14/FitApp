// Shared test setup: deterministic env, an in-process server, and JWT helpers.
process.env.JWT_SECRET = 'test-secret-not-a-placeholder';
process.env.ADMIN_GOOGLE_IDS = 'admin-google-id';
process.env.BOT_PASSWORD = 'bot-secret-for-tests';
process.env.NODE_ENV = 'test';

// The app logs heavily; keep test output readable (set TEST_LOGS=1 to see it).
if (!process.env.TEST_LOGS) {
  for (const level of ['log', 'info', 'warn', 'error']) console[level] = () => {};
}

const jwt = require('jsonwebtoken');

function sign(googleId, opts = {}) {
  const { iat, ...rest } = opts;
  const payload = { googleId, name: 'Test' };
  if (iat) payload.iat = iat;
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d', ...rest });
}

async function startApp() {
  const app = require('../index.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { sign, startApp };
