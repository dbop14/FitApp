// Health data source settings. Names of env vars only; values come from the environment.

const GOOGLE_HEALTH_API_BASE = 'https://health.googleapis.com/v4';

// Read-only, and no sleep: Points v2 does not score sleep.
const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly', // steps, exercise, active zone minutes
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly', // weight, heart rate
];

// Google Health exerciseType values that count as strength sessions.
const GOOGLE_HEALTH_STRENGTH_TYPES = new Set([
  'STRENGTH_TRAINING',
  'FUNCTIONAL_STRENGTH_TRAINING',
  'WEIGHTLIFTING',
  'WEIGHTS',
  'WEIGHT_MACHINES',
  'FREE_WEIGHTS',
  'POWERLIFTING',
  'BODY_WEIGHT',
  'CALISTHENICS',
  'RESISTANCE_BANDS',
  'CROSSFIT',
  'CORE_TRAINING',
  'TRX',
]);

// How many days a normal sync and a post-connect backfill pull.
const SYNC_DAYS = 2;
const CONNECT_BACKFILL_DAYS = 30;

function isGoogleHealthEnabled() {
  return String(process.env.GOOGLE_HEALTH_ENABLED || '').toLowerCase() === 'true';
}

// The health connection may use its own OAuth client, or reuse the sign-in client.
function googleHealthClient() {
  return {
    clientId: process.env.GOOGLE_HEALTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_HEALTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_HEALTH_REDIRECT_URI
      || (process.env.GOOGLE_REDIRECT_URI || '').replace('/api/auth/google/callback', '/api/auth/google-health/callback'),
  };
}

module.exports = {
  GOOGLE_HEALTH_API_BASE,
  GOOGLE_HEALTH_SCOPES,
  GOOGLE_HEALTH_STRENGTH_TYPES,
  SYNC_DAYS,
  CONNECT_BACKFILL_DAYS,
  isGoogleHealthEnabled,
  googleHealthClient,
};
