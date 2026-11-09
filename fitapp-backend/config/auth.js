// Central auth configuration. Read secrets only through these helpers so the
// placeholder check and admin allow-list live in one place.

const PLACEHOLDER_SECRETS = new Set([
  'your_jwt_secret',
  'your_jwt_secret_change_in_production',
]);

// JWTs older than this (by `iat`) cannot be exchanged for a fresh one via
// POST /api/auth/token; the user has to sign in with Google again.
const TOKEN_REISSUE_MAX_AGE_DAYS = 30;

function getJwtSecret() {
  return process.env.JWT_SECRET || 'your_jwt_secret';
}

function jwtSecretIsPlaceholder() {
  return !process.env.JWT_SECRET || PLACEHOLDER_SECRETS.has(process.env.JWT_SECRET);
}

// App-wide admins (for /api/admin/* and debug endpoints), as a comma-separated
// list of Google IDs. Unset means nobody is an app admin.
function getAdminGoogleIds() {
  return (process.env.ADMIN_GOOGLE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  TOKEN_REISSUE_MAX_AGE_DAYS,
  getJwtSecret,
  jwtSecretIsPlaceholder,
  getAdminGoogleIds,
};
