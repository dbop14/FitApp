// OAuth for the WHOOP API. Tokens are stored on the User and never logged.
//
// WHOOP specifics:
// - `state` must be exactly 8 characters, so it cannot carry a signed token.
//   We store a random nonce on the user and look the user up by it.
// - Refresh tokens rotate: every refresh returns a new one and invalidates the
//   old one, so refreshes for a user run one at a time and always save.
const crypto = require('crypto');
const User = require('../models/User');
const { WHOOP_AUTH_URL, WHOOP_TOKEN_URL, WHOOP_API_BASE, WHOOP_SCOPES, whoopClient } = require('../config/healthSources');

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function newState() {
  const bytes = crypto.randomBytes(8);
  return [...bytes].map((b) => STATE_ALPHABET[b % STATE_ALPHABET.length]).join('');
}

// Saves a fresh state on the user and returns WHOOP's consent URL.
async function buildAuthUrl(user) {
  const { clientId, redirectUri } = whoopClient();
  const state = newState();
  user.whoopOAuthState = state;
  user.whoopOAuthStateExpiry = new Date(Date.now() + STATE_TTL_MS);
  await user.save();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: WHOOP_SCOPES.join(' '),
    state,
  });
  return `${WHOOP_AUTH_URL}?${params}`;
}

// One use only: the state is cleared once found.
async function consumeState(state) {
  if (!/^[A-Za-z0-9]{8}$/.test(String(state || ''))) return null;
  const user = await User.findOne({ whoopOAuthState: state, whoopOAuthStateExpiry: { $gt: new Date() } });
  if (!user) return null;
  user.whoopOAuthState = undefined;
  user.whoopOAuthStateExpiry = undefined;
  return user;
}

async function tokenRequest(body) {
  const { clientId, clientSecret } = whoopClient();
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`WHOOP token endpoint ${res.status}: ${json.error || 'unknown'}`);
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

async function exchangeCode(code) {
  const { redirectUri } = whoopClient();
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiry: Date.now() + (t.expires_in || 3600) * 1000,
    scope: t.scope || '',
  };
}

const refreshing = new Map(); // googleId -> Promise<string>

// Returns a valid access token, refreshing (and saving the rotated refresh token) when needed.
async function ensureValidWhoopToken(user) {
  if (!user.whoopRefreshToken && !user.whoopAccessToken) {
    const err = new Error('WHOOP not connected');
    err.code = 'not_connected';
    throw err;
  }
  const stillValid = user.whoopAccessToken && user.whoopTokenExpiry && user.whoopTokenExpiry - Date.now() > 60 * 1000;
  if (stillValid) return user.whoopAccessToken;
  if (!user.whoopRefreshToken) {
    const err = new Error('WHOOP token expired and no refresh token');
    err.code = 'invalid_grant';
    throw err;
  }
  if (refreshing.has(user.googleId)) {
    const token = await refreshing.get(user.googleId);
    user.whoopAccessToken = token;
    return token;
  }
  const run = (async () => {
    try {
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: user.whoopRefreshToken, scope: 'offline' });
      user.whoopAccessToken = t.access_token;
      user.whoopTokenExpiry = Date.now() + (t.expires_in || 3600) * 1000;
      if (t.refresh_token) user.whoopRefreshToken = t.refresh_token;
      user.whoopLastError = undefined;
      await user.save();
      return user.whoopAccessToken;
    } catch (err) {
      if (err.code === 'invalid_grant' || err.status === 400 || err.status === 401) {
        user.whoopLastError = 'invalid_grant';
        await user.save().catch(() => {});
      }
      throw err;
    }
  })();
  refreshing.set(user.googleId, run);
  try {
    return await run;
  } finally {
    refreshing.delete(user.googleId);
  }
}

// Best effort: revoke this app's access for the user.
async function revokeAccess(user) {
  if (!user.whoopAccessToken && !user.whoopRefreshToken) return;
  try {
    const token = await ensureValidWhoopToken(user);
    await fetch(`${WHOOP_API_BASE}/v2/user/access`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // ignore: we clear our copy of the tokens either way
  }
}

module.exports = { buildAuthUrl, consumeState, exchangeCode, ensureValidWhoopToken, revokeAccess, newState };
