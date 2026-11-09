// Points v2 scoring engine. Pure: no database, no clock (pass `asOf`).
//
// scoreChallengeV2(days, weighIns, config) -> breakdown
//
// days:     [{ date: 'YYYY-MM-DD', steps: number|null, effortPoints?: number,
//              strengthSessions?: number, finalized?: boolean }]
//           One entry per calendar day in APP_TIMEZONE. `steps: null` (or a
//           missing day) means no data yet, not zero. strengthSessions counts
//           sessions that already meet STRENGTH_MIN_MINUTES.
// weighIns: [{ date: 'YYYY-MM-DD', weight: number }] readings from weigh-in
//           days only (manual or synced); the latest one is used.
// config:   the constants from config/scoringV2.js plus the challenge's
//           { stepGoal, startDate, endDate, startingWeight, asOf }.
//           asOf is an ISO timestamp, or a 'YYYY-MM-DD' meaning the end of that day.

const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' -> day number (days since epoch). Calendar arithmetic only.
function dayNumber(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

// Day number of `asOf` in `timeZone`.
function asOfDayNumber(asOf, timeZone) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(asOf))) return dayNumber(asOf);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(asOf));
  return dayNumber(ymd);
}

// Hours from the end of day `n` (midnight after it, in timeZone) to `asOf`.
// Approximated with whole days for date-only asOf values.
function hoursSinceDayEnded(n, asOf, timeZone) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(asOf))) {
    // asOf means "end of that day": that many whole days after day n ended.
    return (dayNumber(asOf) - n) * 24;
  }
  const asOfDate = new Date(asOf);
  const todayN = asOfDayNumber(asOf, timeZone);
  // Hours elapsed in today (in timeZone) so far.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(asOfDate);
  const hh = Number(parts.find((p) => p.type === 'hour').value);
  const mm = Number(parts.find((p) => p.type === 'minute').value);
  return (todayN - n - 1) * 24 + hh + mm / 60;
}

const round2 = (x) => Math.round(x * 100) / 100;

function normalizeStepGoal(stepGoal, fallback) {
  const n = typeof stepGoal === 'string' ? parseInt(stepGoal, 10) : Number(stepGoal);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function scoreChallengeV2(days, weighIns, config) {
  const c = config;
  const timeZone = c.timeZone || process.env.APP_TIMEZONE || 'America/New_York';
  const stepGoal = normalizeStepGoal(c.stepGoal, c.DEFAULT_STEP_GOAL);
  const startN = dayNumber(c.startDate);
  const endN = c.endDate ? dayNumber(c.endDate) : Infinity;
  const todayN = asOfDayNumber(c.asOf, timeZone);
  const lastScoredN = Math.min(endN, todayN);

  // Work in tenths of a point so decimals add up exactly.
  const stepCapTenths = ((stepGoal + c.STEP_CAP_ABOVE_GOAL) / c.STEPS_PER_POINT) * 10;
  const tenthsPerIncrement = (c.STEP_INCREMENT / c.STEPS_PER_POINT) * 10;
  const effortCapTenths = c.EFFORT_DAILY_CAP * 10;
  const effortTenthsPerPoint = 10 / c.EFFORT_DIVISOR;

  const byDay = new Map();
  for (const d of days || []) {
    if (!d || !d.date) continue;
    byDay.set(dayNumber(d.date), d);
  }

  const totals = { steps: 0, goalBonus: 0, effort: 0, strength: 0, weekly: 0, weightLoss: 0 };
  const dayResults = [];
  const weeks = [];

  for (let n = startN; n <= lastScoredN; n++) {
    const weekIndex = Math.floor((n - startN) / c.WEEK_LENGTH_DAYS);
    if (!weeks[weekIndex]) {
      weeks[weekIndex] = { index: weekIndex, startDate: fromDayNumber(startN + weekIndex * c.WEEK_LENGTH_DAYS), activeDays: 0, strengthCounted: 0, points: 0 };
    }
    const week = weeks[weekIndex];
    const d = byDay.get(n);
    const steps = d && d.steps !== null && d.steps !== undefined && Number.isFinite(Number(d.steps)) ? Number(d.steps) : null;
    const effortRaw = d && Number.isFinite(Number(d.effortPoints)) ? Math.max(0, Number(d.effortPoints)) : 0;
    const sessions = d && Number.isFinite(Number(d.strengthSessions)) ? Math.max(0, Math.floor(Number(d.strengthSessions))) : 0;

    // Steps and goal bonus (no data -> nothing yet).
    const stepTenths = steps === null ? 0 : Math.min(Math.floor(steps / c.STEP_INCREMENT) * tenthsPerIncrement, stepCapTenths);
    const goalBonus = steps !== null && steps >= stepGoal ? c.GOAL_BONUS : 0;

    // Effort.
    const effortTenths = Math.min(Math.floor(effortRaw) * effortTenthsPerPoint, effortCapTenths);

    // Strength: in date order, at most N per day and M per week.
    const strengthRoom = Math.max(0, c.STRENGTH_MAX_PER_WEEK - week.strengthCounted);
    const strengthCounted = Math.min(sessions, c.STRENGTH_MAX_PER_DAY, strengthRoom);
    week.strengthCounted += strengthCounted;
    const strengthPoints = strengthCounted * c.STRENGTH_POINTS;

    const active = (steps !== null && steps >= c.ACTIVE_DAY_STEPS)
      || effortRaw >= c.ACTIVE_DAY_EFFORT
      || strengthCounted > 0;
    if (active) week.activeDays += 1;

    const finalized = Boolean(d && d.finalized);
    const provisional = !finalized
      && (steps === null || hoursSinceDayEnded(n, c.asOf, timeZone) < c.FINALIZE_AFTER_HOURS);

    totals.steps += stepTenths;
    totals.goalBonus += goalBonus;
    totals.effort += effortTenths;
    totals.strength += strengthPoints;

    dayResults.push({
      date: fromDayNumber(n),
      steps,
      stepPoints: stepTenths / 10,
      goalBonusPoints: goalBonus,
      effortPoints: effortTenths / 10,
      strengthPoints,
      strengthSessionsCounted: strengthCounted,
      active,
      provisional,
      total: round2(stepTenths / 10 + goalBonus + effortTenths / 10 + strengthPoints),
    });
  }

  for (const week of weeks) {
    if (!week) continue;
    week.points = week.activeDays >= c.WEEKLY_MIN_ACTIVE_DAYS ? c.WEEKLY_BONUS : 0;
    totals.weekly += week.points;
  }

  // Weight loss from the latest weigh-in reading on or before asOf.
  let weight = { startingWeight: c.startingWeight || null, latestWeight: null, latestDate: null, actualPctLost: 0, countedPct: 0 };
  const readings = (weighIns || [])
    .filter((w) => w && w.date && Number(w.weight) > 0 && dayNumber(w.date) >= startN && dayNumber(w.date) <= lastScoredN)
    .sort((a, b) => dayNumber(a.date) - dayNumber(b.date));
  if (c.startingWeight > 0 && readings.length > 0) {
    const latest = readings[readings.length - 1];
    const actualPctLost = Math.max(0, ((c.startingWeight - Number(latest.weight)) / c.startingWeight) * 100);
    const daysElapsed = Math.max(0, lastScoredN - startN + 1);
    const weeksElapsed = Math.ceil(daysElapsed / 7);
    const countedPct = Math.min(actualPctLost, c.WEIGHT_MAX_PCT_PER_WEEK * weeksElapsed);
    totals.weightLoss = Math.round(c.WEIGHT_POINTS_PER_PCT * countedPct + 1e-9);
    weight = { startingWeight: c.startingWeight, latestWeight: Number(latest.weight), latestDate: latest.date, actualPctLost: round2(actualPctLost), countedPct: round2(countedPct), weeksElapsed };
  }

  const categories = {
    steps: totals.steps / 10,
    goalBonus: totals.goalBonus,
    effort: totals.effort / 10,
    strength: totals.strength,
    weekly: totals.weekly,
    weightLoss: totals.weightLoss,
  };
  const total = round2(Object.values(categories).reduce((a, b) => a + b, 0));

  return { total, categories, days: dayResults, weeks: weeks.filter(Boolean), weight, stepGoal };
}

// Convert a workout's heart-zone minutes into Effort Points.
// Workouts shorter than MIN_WORKOUT_MINUTES earn nothing.
function effortPointsForWorkout({ start, end, moderateMinutes = 0, vigorousMinutes = 0 }, config) {
  const durationMin = (new Date(end) - new Date(start)) / 60000;
  if (!(durationMin >= config.MIN_WORKOUT_MINUTES)) return 0;
  return moderateMinutes * config.MODERATE_EFFORT_PER_MIN + vigorousMinutes * config.VIGOROUS_EFFORT_PER_MIN;
}

module.exports = { scoreChallengeV2, effortPointsForWorkout, dayNumber, fromDayNumber };
