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

// --- WHOOP (behind WHOOP_ENABLED) ---------------------------------------------

const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

// No read:sleep or read:recovery: Points v2 does not score sleep. `offline` is
// not a data scope; WHOOP only issues a refresh token when it is requested.
const WHOOP_DATA_SCOPES = ['read:cycles', 'read:workout', 'read:body_measurement', 'read:profile'];
const WHOOP_SCOPES = [...WHOOP_DATA_SCOPES, 'offline'];

// WHOOP sport_name -> category. Names are matched lowercased with '-'/'_' as
// spaces. 'strength' sessions of 20+ minutes count as strength sessions.
// 'excluded' activities (not exercise) earn no Effort Points even though WHOOP
// records heart-rate zones for them. Anything unlisted is 'cardio'.
const WHOOP_SPORT_CATEGORIES = Object.freeze({
  weightlifting: 'strength',
  powerlifting: 'strength',
  'strength trainer': 'strength',
  'functional fitness': 'strength',
  crossfit: 'strength',
  'box fitness': 'cardio',
  gymnastics: 'strength',
  'rock climbing': 'strength',
  barre: 'strength',
  pilates: 'strength',
  meditation: 'excluded',
  'high stress work': 'excluded',
  parenting: 'excluded',
  gaming: 'excluded',
  babywearing: 'excluded',
  toddlerwearing: 'excluded',
  'stage performance': 'excluded',
  'watching sports': 'excluded',
  'commuting': 'excluded',
  'manual labor': 'excluded',
  'motor racing': 'excluded',
  sauna: 'excluded',
  'ice bath': 'excluded',
  stretching: 'excluded',
  yoga: 'cardio',
});

function whoopSportCategory(sportName) {
  const key = String(sportName || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return WHOOP_SPORT_CATEGORIES[key] || 'cardio';
}

function isWhoopEnabled() {
  return String(process.env.WHOOP_ENABLED || '').toLowerCase() === 'true';
}

function whoopClient() {
  return {
    clientId: process.env.WHOOP_CLIENT_ID,
    clientSecret: process.env.WHOOP_CLIENT_SECRET,
    redirectUri: process.env.WHOOP_REDIRECT_URI
      || (process.env.GOOGLE_REDIRECT_URI || '').replace('/api/auth/google/callback', '/api/auth/whoop/callback'),
  };
}

module.exports = {
  WHOOP_API_BASE,
  WHOOP_AUTH_URL,
  WHOOP_TOKEN_URL,
  WHOOP_DATA_SCOPES,
  WHOOP_SCOPES,
  WHOOP_SPORT_CATEGORIES,
  whoopSportCategory,
  isWhoopEnabled,
  whoopClient,
  GOOGLE_HEALTH_API_BASE,
  GOOGLE_HEALTH_SCOPES,
  GOOGLE_HEALTH_STRENGTH_TYPES,
  SYNC_DAYS,
  CONNECT_BACKFILL_DAYS,
  isGoogleHealthEnabled,
  googleHealthClient,
};
