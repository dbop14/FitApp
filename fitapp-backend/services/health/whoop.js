// WHOOP API v2 adapter (https://api.prod.whoop.com/developer/v2).
// Returns normalized data; never writes to the database. Same shape as the
// Google Health adapter:
//
//   getDailySteps(user, startYmd, endYmd)  -> [{ date, steps|null }]  (end inclusive)
//   getWeights()                           -> []  (WHOOP weight is ignored by design)
//   getWorkouts(user, startYmd, endYmd)    -> [{ date, start, end, type, category, durationMinutes,
//                                               moderateMinutes, vigorousMinutes, effortPoints, isStrength, scored }]
//
// Steps: each cycle's step_count is credited to the local day the cycle mostly
// covers (see cycleDate). Cycles run bedtime to bedtime, usually starting before
// midnight, so crediting the start day (as first specified) put most days' steps
// on the day before.
// Effort: WHOOP heart-rate zones 1-2 are moderate, 3-5 vigorous. Strain is ignored.

const SCORING_V2 = require('../../config/scoringV2');
const { WHOOP_API_BASE, whoopSportCategory } = require('../../config/healthSources');
const { ensureValidWhoopToken } = require('../../utils/whoopAuth');
const { effortPointsForWorkout, dayNumber, fromDayNumber } = require('../scoring/scoreChallengeV2');

const PAGE_LIMIT = 25; // WHOOP maximum
const MAX_PAGES = 40;

class WhoopError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(user, path, query = {}) {
  const token = await ensureValidWhoopToken(user);
  const url = new URL(`${WHOOP_API_BASE}/${path}`);
  Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }
  if (!res.ok) {
    throw new WhoopError(`WHOOP GET ${path} -> ${res.status}`, { status: res.status, code: json?.error || `http_${res.status}` });
  }
  return json || {};
}

async function listAll(user, path, startIso, endIso) {
  const out = [];
  let nextToken;
  for (let page = 0; page < MAX_PAGES; page++) {
    const json = await call(user, path, { start: startIso, end: endIso, limit: PAGE_LIMIT, nextToken });
    out.push(...(json.records || []));
    nextToken = json.next_token || json.nextToken;
    if (!nextToken) break;
  }
  return out;
}

// "-05:00" / "+0530" / "Z" -> minutes
function offsetMinutes(tz) {
  if (!tz || tz === 'Z') return 0;
  const m = String(tz).match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// Local calendar day of an instant, using the record's own UTC offset.
function localDate(iso, tz) {
  return new Date(Date.parse(iso) + offsetMinutes(tz) * 60000).toISOString().slice(0, 10);
}

// The local day a cycle mostly covers: the day of its midpoint, or for the open
// (current) cycle the day 12 hours after it started.
const OPEN_CYCLE_HOURS = 12;
function cycleDate(c) {
  const start = Date.parse(c.start);
  const end = c.end ? Date.parse(c.end) : null;
  const mid = end && end > start ? start + (end - start) / 2 : start + OPEN_CYCLE_HOURS * 3600000;
  return localDate(new Date(mid).toISOString(), c.timezone_offset);
}

// Query window padded a day each side so offsets cannot drop a record.
function windowIso(startYmd, endYmd) {
  return {
    startIso: `${fromDayNumber(dayNumber(startYmd) - 1)}T00:00:00.000Z`,
    endIso: `${fromDayNumber(dayNumber(endYmd) + 2)}T00:00:00.000Z`,
  };
}

// --- Steps -------------------------------------------------------------------

async function getDailySteps(user, startYmd, endYmd) {
  const { startIso, endIso } = windowIso(startYmd, endYmd);
  const cycles = await listAll(user, 'v2/cycle', startIso, endIso);
  return parseDailySteps(cycles, startYmd, endYmd);
}

function parseDailySteps(cycles, startYmd, endYmd) {
  const byDate = new Map();
  for (const c of cycles) {
    if (!c.start || c.step_count === undefined || c.step_count === null) continue;
    const date = cycleDate(c);
    byDate.set(date, (byDate.get(date) || 0) + Number(c.step_count));
  }
  const days = [];
  for (let n = dayNumber(startYmd); n <= dayNumber(endYmd); n++) {
    const date = fromDayNumber(n);
    days.push({ date, steps: byDate.has(date) ? byDate.get(date) : null });
  }
  return days;
}

// --- Weight ------------------------------------------------------------------

// WHOOP weight is ignored: weigh-ins come from manual entry.
async function getWeights() {
  return [];
}

// --- Workouts ----------------------------------------------------------------

async function getWorkouts(user, startYmd, endYmd) {
  const { startIso, endIso } = windowIso(startYmd, endYmd);
  const records = await listAll(user, 'v2/activity/workout', startIso, endIso);
  return parseWorkouts(records, startYmd, endYmd);
}

function parseWorkouts(records, startYmd, endYmd, config = SCORING_V2) {
  const out = [];
  for (const w of records) {
    if (!w.start || !w.end) continue;
    const date = localDate(w.start, w.timezone_offset);
    if (date < startYmd || date > endYmd) continue;
    const durationMinutes = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000);
    const category = whoopSportCategory(w.sport_name);
    const z = w.score?.zone_durations || {};
    const minutes = (...keys) => Math.round(keys.reduce((sum, k) => sum + Number(z[k] || 0), 0) / 60000);
    // Unscored (PENDING_SCORE / UNSCORABLE) workouts have no zones yet: 0 until a later sync.
    const scored = w.score_state === 'SCORED' && !!w.score?.zone_durations;
    const moderateMinutes = scored ? minutes('zone_one_milli', 'zone_two_milli') : 0;
    const vigorousMinutes = scored ? minutes('zone_three_milli', 'zone_four_milli', 'zone_five_milli') : 0;
    const effortPoints = category === 'excluded'
      ? 0
      : effortPointsForWorkout({ start: w.start, end: w.end, moderateMinutes, vigorousMinutes }, config);
    out.push({
      date,
      start: w.start,
      end: w.end,
      type: w.sport_name || String(w.sport_id ?? 'unknown'),
      category,
      durationMinutes,
      moderateMinutes,
      vigorousMinutes,
      effortPoints,
      scored,
      isStrength: category === 'strength' && durationMinutes >= config.STRENGTH_MIN_MINUTES,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// --- Profile (connect-time test read) -----------------------------------------

async function getProfile(user) {
  const p = await call(user, 'v2/user/profile/basic');
  return { userId: p.user_id !== undefined ? String(p.user_id) : null };
}

module.exports = {
  name: 'whoop',
  getDailySteps,
  getWeights,
  getWorkouts,
  getProfile,
  // exported for tests
  parseDailySteps,
  parseWorkouts,
  localDate,
  cycleDate,
  offsetMinutes,
  WhoopError,
};
