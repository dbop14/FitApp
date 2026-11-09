// Points v2: every tunable number lives here. Logic in services/scoring reads
// only from this object (plus the challenge's own stepGoal / dates).

module.exports = Object.freeze({
  // Steps: 1 point per STEPS_PER_POINT steps, in tenths (100 steps = 0.1 point),
  // stopping STEP_CAP_ABOVE_GOAL steps above the challenge's stepGoal.
  STEPS_PER_POINT: 1000,
  STEP_INCREMENT: 100,
  STEP_CAP_ABOVE_GOAL: 2000,
  DEFAULT_STEP_GOAL: 10000,

  // +GOAL_BONUS when steps >= stepGoal.
  GOAL_BONUS: 2,

  // Effort: floor(effortPoints) / EFFORT_DIVISOR, capped at EFFORT_DAILY_CAP.
  // Effort Points come only from workouts of MIN_WORKOUT_MINUTES or more:
  // MODERATE_EFFORT_PER_MIN per moderate minute, VIGOROUS_EFFORT_PER_MIN per vigorous minute.
  EFFORT_DIVISOR: 10,
  EFFORT_DAILY_CAP: 8,
  MIN_WORKOUT_MINUTES: 10,
  MODERATE_EFFORT_PER_MIN: 1,
  VIGOROUS_EFFORT_PER_MIN: 2,

  // Strength: STRENGTH_POINTS per session of STRENGTH_MIN_MINUTES or more,
  // counting at most STRENGTH_MAX_PER_DAY a day and STRENGTH_MAX_PER_WEEK a week.
  STRENGTH_POINTS: 4,
  STRENGTH_MIN_MINUTES: 20,
  STRENGTH_MAX_PER_DAY: 1,
  STRENGTH_MAX_PER_WEEK: 4,

  // Weekly consistency: +WEEKLY_BONUS for each 7-day block (from the challenge
  // start) with at least WEEKLY_MIN_ACTIVE_DAYS active days. An active day has
  // steps >= ACTIVE_DAY_STEPS, or effortPoints >= ACTIVE_DAY_EFFORT, or a counted
  // strength session.
  WEEK_LENGTH_DAYS: 7,
  WEEKLY_BONUS: 5,
  WEEKLY_MIN_ACTIVE_DAYS: 5,
  ACTIVE_DAY_STEPS: 6000,
  ACTIVE_DAY_EFFORT: 20,

  // Weight loss: round(WEIGHT_POINTS_PER_PCT * countedPct), where
  // countedPct = min(actualPctLost, WEIGHT_MAX_PCT_PER_WEEK * ceil(daysElapsed / 7)).
  WEIGHT_POINTS_PER_PCT: 20,
  WEIGHT_MAX_PCT_PER_WEEK: 0.75,

  // A day's points are provisional until this long after the day ends.
  FINALIZE_AFTER_HOURS: 48,
});
