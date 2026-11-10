// OAuth for the Google Health API. Tokens are stored on the User and never logged.
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/auth');
const { GOOGLE_HEALTH_SCOPES, googleHealthClient } = require('../config/healthSources');

const STATE_PURPOSE = 'google-health-connect';

// The browser is sent to Google by a plain redirect, which cannot carry our JWT,
// so the signed-in user's identity rides in a short-lived signed `state`.
function signState(googleId) {
  return jwt.sign({ googleId, purpose: STATE_PURPOSE }, getJwtSecret(), { expiresIn: '10m' });
}

function verifyState(state) {
  const claims = jwt.verify(state, getJwtSecret());
  if (claims.purpose !== STATE_PURPOSE || !claims.googleId) throw new Error('bad state');
  return claims.googleId;
}

function buildAuthUrl(googleId) {
  const { clientId, redirectUri } = googleHealthClient();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_HEALTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: signState(googleId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body) {
  const { clientId, clientSecret } = googleHealthClient();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google token endpoint ${res.status}: ${json.error || 'unknown'}`);
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

async function exchangeCode(code) {
  const { redirectUri } = googleHealthClient();
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiry: Date.now() + (t.expires_in || 3600) * 1000,
    scope: t.scope || '',
  };
}

// Returns a valid access token, refreshing and saving it when needed.
async function ensureValidGoogleHealthToken(user) {
  if (!user.googleHealthRefreshToken && !user.googleHealthAccessToken) {
    const err = new Error('Google Health not connected');
    err.code = 'not_connected';
    throw err;
  }
  const stillValid = user.googleHealthAccessToken && user.googleHealthTokenExpiry
    && user.googleHealthTokenExpiry - Date.now() > 60 * 1000;
  if (stillValid) return user.googleHealthAccessToken;
  if (!user.googleHealthRefreshToken) {
    const err = new Error('Google Health token expired and no refresh token');
    err.code = 'invalid_grant';
    throw err;
  }
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: user.googleHealthRefreshToken });
    user.googleHealthAccessToken = t.access_token;
    user.googleHealthTokenExpiry = Date.now() + (t.expires_in || 3600) * 1000;
    if (t.refresh_token) user.googleHealthRefreshToken = t.refresh_token;
    user.googleHealthLastError = undefined;
    await user.save();
    return user.googleHealthAccessToken;
  } catch (err) {
    if (err.code === 'invalid_grant') {
      user.googleHealthLastError = 'invalid_grant';
      await user.save().catch(() => {});
    }
    throw err;
  }
}

// Best effort; Google returns 200 for a revoked or 400 for an unknown token.
async function revokeToken(token) {
  if (!token) return;
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

module.exports = { buildAuthUrl, verifyState, signState, exchangeCode, ensureValidGoogleHealthToken, revokeToken };
