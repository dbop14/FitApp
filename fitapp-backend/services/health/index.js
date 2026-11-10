// HealthSource: the one place that decides where a user's health data comes from.
// Callers ask getHealthSource(user) / syncHealthHistory(user) and never pick a
// provider themselves. Legacy sources (google-fit, fitbit) still run through their
// existing code for Classic challenges; this module routes the new ones.

const FitnessHistory = require('../../models/FitnessHistory');
const { isGoogleHealthEnabled, isWhoopEnabled, SYNC_DAYS } = require('../../config/healthSources');
const { dayNumber, fromDayNumber } = require('../scoring/scoreChallengeV2');
const googleHealth = require('./googleHealth');
const whoop = require('./whoop');

const APP_TIMEZONE = () => process.env.APP_TIMEZONE || 'America/New_York';

const todayYmd = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE(), year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

// Offset of APP_TIMEZONE from UTC at instant t, in ms.
function zoneOffsetMs(t) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE(), hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - t;
}

// Midnight of `ymd` in APP_TIMEZONE. This is what FitnessHistory.normalizeDate
// stores when the process runs with TZ=APP_TIMEZONE (index.js sets it), but it
// does not depend on the process timezone, so a script that forgets TZ cannot
// create a second row for the same day.
function ymdToLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  let t = utcMidnight - zoneOffsetMs(utcMidnight);
  t = utcMidnight - zoneOffsetMs(t); // settle across a DST change
  return new Date(t);
}

// Which source a user is on: 'google-health' | 'whoop' | 'fitbit' | 'google-fit'.
function getHealthSourceName(user) {
  if (user?.oauthType === 'google' && user.dataSource === 'google-health') return 'google-health';
  return user?.dataSource || 'google-fit';
}

// Adapter object for new-style sources, or null for legacy ones.
function getHealthSource(user) {
  const name = getHealthSourceName(user);
  if (name === 'google-health') return isGoogleHealthEnabled() ? googleHealth : null;
  if (name === 'whoop') return isWhoopEnabled() && (user.whoopRefreshToken || user.whoopAccessToken) ? whoop : null;
  return null;
}

function isLegacySource(user) {
  return ['google-fit', 'fitbit'].includes(getHealthSourceName(user));
}

// Legacy Fitbit endpoints were decommissioned on 2026-10-30 (HTTP 410).
function needsReconnect(user) {
  const name = getHealthSourceName(user);
  if (name === 'fitbit') return true;
  if (name === 'google-health' && user.googleHealthLastError === 'invalid_grant') return true;
  if (name === 'whoop' && user.whoopLastError === 'invalid_grant') return true;
  return false;
}

// Combine adapter output into one row per day.
function buildDailyRows({ steps, weights, workouts }) {
  const rows = new Map();
  const row = (date) => {
    if (!rows.has(date)) rows.set(date, { date });
    return rows.get(date);
  };
  for (const s of steps || []) {
    if (s.steps !== null && s.steps !== undefined) row(s.date).steps = s.steps;
  }
  for (const w of weights || []) row(w.date).weight = w.weightLbs; // sorted by time: latest wins
  for (const w of workouts || []) {
    const r = row(w.date);
    r.effortPoints = (r.effortPoints || 0) + w.effortPoints;
    r.moderateMinutes = (r.moderateMinutes || 0) + w.moderateMinutes;
    r.vigorousMinutes = (r.vigorousMinutes || 0) + w.vigorousMinutes;
    r.strengthSessions = (r.strengthSessions || 0) + (w.isStrength ? 1 : 0);
  }
  // Every day we asked about: no workouts reported means zero effort, not unknown.
  const queriedDays = new Set((steps || []).map((s) => s.date));
  for (const date of queriedDays) {
    const r = row(date);
    r.effortPoints = r.effortPoints || 0;
    r.moderateMinutes = r.moderateMinutes || 0;
    r.vigorousMinutes = r.vigorousMinutes || 0;
    r.strengthSessions = r.strengthSessions || 0;
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Write rows to FitnessHistory. Finalized days keep their steps/activity (the
// model drops those writes); a manual weigh-in on a day is never overwritten.
async function writeRows(userId, rows, source) {
  let written = 0;
  for (const r of rows) {
    const date = ymdToLocalDate(r.date);
    const existing = await FitnessHistory.findOne({ userId, date }).select('source weight').lean();
    // Relabel a day only when this source actually reported steps for it, so a
    // day it has no data for keeps the old source's numbers and label.
    const set = { updatedAt: new Date() };
    if (r.steps !== undefined || !existing) set.source = source;
    for (const f of ['steps', 'effortPoints', 'moderateMinutes', 'vigorousMinutes', 'strengthSessions']) {
      if (r[f] !== undefined) set[f] = r[f];
    }
    const manualWeight = existing && existing.source === 'manual' && existing.weight;
    if (r.weight !== undefined && !manualWeight) set.weight = r.weight;
    if (existing && existing.source === 'manual') delete set.source;
    // A new day with no step data yet stores null ("no data"), not the schema default of 0.
    const onInsert = { createdAt: new Date() };
    if (set.steps === undefined) onInsert.steps = null;
    await FitnessHistory.findOneAndUpdate(
      { userId, date },
      { $set: set, $setOnInsert: onInsert },
      { upsert: true, new: true },
    );
    written++;
  }
  return written;
}

// Pull the last `days` days (including today) for a new-style source and store them.
// Returns { source, rows, today } or null when the user is on a legacy source.
async function syncHealthHistory(user, { days = SYNC_DAYS, now = new Date() } = {}) {
  const adapter = getHealthSource(user);
  if (!adapter) return null;
  const endYmd = todayYmd(now);
  const startYmd = fromDayNumber(dayNumber(endYmd) - (days - 1));
  const [steps, weights, workouts] = await Promise.all([
    adapter.getDailySteps(user, startYmd, endYmd),
    adapter.getWeights(user, startYmd, endYmd),
    adapter.getWorkouts(user, startYmd, endYmd),
  ]);
  const rows = buildDailyRows({ steps, weights, workouts });
  await writeRows(user.googleId, rows, adapter.name);
  const today = rows.find((r) => r.date === endYmd) || { date: endYmd };
  const latestWeight = weights.length ? weights[weights.length - 1].weightLbs : null;
  // Keep the User summary fields current for existing screens.
  user.steps = today.steps ?? user.steps ?? 0;
  if (latestWeight) user.weight = latestWeight;
  user.lastSync = now;
  await user.save();
  return { source: adapter.name, rows, today, latestWeight };
}

module.exports = {
  getHealthSource,
  getHealthSourceName,
  isLegacySource,
  needsReconnect,
  syncHealthHistory,
  buildDailyRows,
  writeRows,
  todayYmd,
  ymdToLocalDate,
};
