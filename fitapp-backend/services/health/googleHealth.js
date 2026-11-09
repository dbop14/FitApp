// Google Health API adapter (https://health.googleapis.com/v4).
// Returns normalized data; never writes to the database.
//
//   getDailySteps(user, startYmd, endYmd)  -> [{ date, steps|null }]  (end inclusive)
//   getWeights(user, startYmd, endYmd)     -> [{ date, weightLbs, time }]
//   getWorkouts(user, startYmd, endYmd)    -> [{ date, start, end, type, durationMinutes,
//                                               moderateMinutes, vigorousMinutes, effortPoints, isStrength }]

const SCORING_V2 = require('../../config/scoringV2');
const { GOOGLE_HEALTH_API_BASE, GOOGLE_HEALTH_STRENGTH_TYPES } = require('../../config/healthSources');
const { ensureValidGoogleHealthToken } = require('../../utils/googleHealthAuth');
const { effortPointsForWorkout, dayNumber, fromDayNumber } = require('../scoring/scoreChallengeV2');

const GRAMS_PER_LB = 453.59237;
const APP_TIMEZONE = () => process.env.APP_TIMEZONE || 'America/New_York';

class GoogleHealthError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function ymdInZone(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE(), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

const toGoogleDate = (ymd) => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};
const fromGoogleDate = (d) => d && d.year
  ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  : null;

// "123s" / "123.5s" / { seconds } -> seconds
function durationSeconds(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return Number(v.seconds || 0) + Number(v.nanos || 0) / 1e9;
  const m = String(v).match(/^(-?\d+(?:\.\d+)?)s$/);
  return m ? Number(m[1]) : 0;
}

async function call(user, method, path, { query, body } = {}) {
  const token = await ensureValidGoogleHealthToken(user);
  const url = new URL(`${GOOGLE_HEALTH_API_BASE}/${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }
  if (!res.ok) {
    const reason = json?.error?.details?.find((d) => d.reason)?.reason || json?.error?.status;
    throw new GoogleHealthError(`Google Health ${method} ${path} -> ${res.status}${reason ? ` (${reason})` : ''}`, {
      status: res.status,
      code: reason,
    });
  }
  return json || {};
}

// list with paging; `filter` uses AIP-160. If the API rejects the filter, retry
// unfiltered (newest first) and stop once we are past the window.
async function listDataPoints(user, dataType, filter, isBeforeWindow) {
  const out = [];
  let pageToken;
  let useFilter = true;
  for (let page = 0; page < 20; page++) {
    let json;
    try {
      json = await call(user, 'GET', `users/me/dataTypes/${dataType}/dataPoints`, {
        query: { filter: useFilter ? filter : undefined, pageSize: 500, pageToken },
      });
    } catch (err) {
      if (err.status === 400 && useFilter && page === 0) {
        useFilter = false;
        page = -1;
        continue;
      }
      throw err;
    }
    const points = json.dataPoints || [];
    out.push(...points);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
    if (!useFilter && points.length && isBeforeWindow(points[points.length - 1])) break;
  }
  return out;
}

// --- Steps -------------------------------------------------------------------

async function getDailySteps(user, startYmd, endYmd) {
  const endExclusive = fromDayNumber(dayNumber(endYmd) + 1);
  const json = await call(user, 'POST', 'users/me/dataTypes/steps/dataPoints:dailyRollUp', {
    body: {
      range: { start: { date: toGoogleDate(startYmd) }, end: { date: toGoogleDate(endExclusive) } },
      windowSizeDays: 1,
      pageSize: 400,
    },
  });
  return parseDailySteps(json, startYmd, endYmd);
}

function parseDailySteps(json, startYmd, endYmd) {
  const byDate = new Map();
  for (const p of json.rollupDataPoints || []) {
    const date = fromGoogleDate(p.civilStartTime?.date);
    if (!date) continue;
    const raw = p.steps?.countSum ?? p.steps?.count;
    byDate.set(date, raw === undefined || raw === null ? null : Number(raw));
  }
  const days = [];
  for (let n = dayNumber(startYmd); n <= dayNumber(endYmd); n++) {
    const date = fromDayNumber(n);
    days.push({ date, steps: byDate.has(date) ? byDate.get(date) : null });
  }
  return days;
}

// --- Weight ------------------------------------------------------------------

async function getWeights(user, startYmd, endYmd) {
  const startIso = `${startYmd}T00:00:00Z`;
  const endIso = `${fromDayNumber(dayNumber(endYmd) + 2)}T00:00:00Z`; // pad for timezone
  const filter = `weight.sample_time.physical_time >= "${startIso}" AND weight.sample_time.physical_time < "${endIso}"`;
  const points = await listDataPoints(user, 'weight', filter,
    (p) => new Date(p.weight?.sampleTime?.physicalTime || 0) < new Date(startIso));
  return parseWeights(points, startYmd, endYmd);
}

function parseWeights(points, startYmd, endYmd) {
  const out = [];
  for (const p of points) {
    const grams = Number(p.weight?.weightGrams);
    const time = p.weight?.sampleTime?.physicalTime;
    if (!(grams > 0) || !time) continue;
    const date = ymdInZone(time);
    if (date < startYmd || date > endYmd) continue;
    out.push({ date, time, weightLbs: Math.round((grams / GRAMS_PER_LB) * 10) / 10 });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

// --- Workouts ----------------------------------------------------------------

async function getWorkouts(user, startYmd, endYmd) {
  const startIso = `${fromDayNumber(dayNumber(startYmd) - 1)}T00:00:00Z`; // pad for timezone
  const endIso = `${fromDayNumber(dayNumber(endYmd) + 2)}T00:00:00Z`;
  const filter = `exercise.interval.start_time >= "${startIso}" AND exercise.interval.start_time < "${endIso}"`;
  const points = await listDataPoints(user, 'exercise', filter,
    (p) => new Date(p.exercise?.interval?.startTime || 0) < new Date(startIso));
  return parseWorkouts(points, startYmd, endYmd);
}

function parseWorkouts(points, startYmd, endYmd, config = SCORING_V2) {
  const out = [];
  for (const p of points) {
    const ex = p.exercise;
    const start = ex?.interval?.startTime;
    const end = ex?.interval?.endTime;
    if (!start || !end) continue;
    // Credit a workout to the calendar day it starts on.
    const date = fromGoogleDate(ex.interval.civilStartTime?.date) || ymdInZone(start);
    if (date < startYmd || date > endYmd) continue;
    const zones = ex.metricsSummary?.heartRateZoneDurations;
    const moderateMinutes = Math.round(durationSeconds(zones?.moderateTime) / 60);
    // Peak counts as vigorous (Fitbit cardio + peak zones are both 2x active zone minutes).
    const vigorousMinutes = Math.round((durationSeconds(zones?.vigorousTime) + durationSeconds(zones?.peakTime)) / 60);
    const durationMinutes = Math.round((new Date(end) - new Date(start)) / 60000);
    let effortPoints = effortPointsForWorkout({ start, end, moderateMinutes, vigorousMinutes }, config);
    // No zone split reported: fall back to the session's active zone minutes,
    // which are already weighted 1x moderate / 2x vigorous.
    if (!zones && ex.metricsSummary?.activeZoneMinutes !== undefined && durationMinutes >= config.MIN_WORKOUT_MINUTES) {
      effortPoints = Number(ex.metricsSummary.activeZoneMinutes) || 0;
    }
    const type = ex.exerciseType || 'EXERCISE_TYPE_UNSPECIFIED';
    out.push({
      date,
      start,
      end,
      type,
      durationMinutes,
      moderateMinutes,
      vigorousMinutes,
      effortPoints,
      isStrength: GOOGLE_HEALTH_STRENGTH_TYPES.has(type) && durationMinutes >= config.STRENGTH_MIN_MINUTES,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

module.exports = {
  name: 'google-health',
  getDailySteps,
  getWeights,
  getWorkouts,
  // exported for tests
  parseDailySteps,
  parseWeights,
  parseWorkouts,
  durationSeconds,
  GoogleHealthError,
};
