// WHOOP API v2 responses. Shapes match a real dev account checked on
// 2026-11-10 (cycles, workouts, profile); values and IDs are made up.
//
// What the real account showed:
// - Cycles run bedtime to bedtime and usually start before midnight, so a
//   cycle's steps belong to the day it mostly covers, not its start day.
// - The current cycle has end: null and is already score_state SCORED.
// - Workout sport_name is lowercase with hyphens ("mountain-biking"); WHOOP's
//   generic catch-all is sport_name "activity", sport_id -1.
// - Offsets look like "-05:00".

const cycle = (id, start, end, stepCount, extra = {}) => ({
  id, user_id: 10129, created_at: start, updated_at: end || start,
  start, end, timezone_offset: '-05:00', score_state: 'SCORED',
  score: { strain: 9.4, kilojoule: 8700.5, average_heart_rate: 66, max_heart_rate: 158 },
  ...(stepCount === undefined ? {} : { step_count: stepCount }),
  ...extra,
});

// Newest first, as the API returns them.
const cyclesPage1 = {
  records: [
    // Current cycle: bedtime 11:10 PM Nov 8 local, still open -> Nov 9 (start + 12h).
    cycle(93845, '2026-11-09T04:10:00.000Z', null, 4100),
    // 11:40 PM Nov 6 -> 11:10 PM Nov 8 local: a long cycle; midpoint 11:25 PM Nov 7 local -> Nov 7.
    // (Crediting the start day would have put it on Nov 6.)
    cycle(93844, '2026-11-07T04:40:00.000Z', '2026-11-09T04:10:00.000Z', 11250),
  ],
  next_token: 'page2',
};
const cyclesPage2 = {
  records: [
    // 10:30 PM Nov 5 -> 11:40 PM Nov 6 local: midpoint Nov 6 -> Nov 6.
    cycle(93843, '2026-11-06T03:30:00.000Z', '2026-11-07T04:40:00.000Z', 750),
    // No step_count reported: ignored (no data).
    cycle(93842, '2026-11-05T04:00:00.000Z', '2026-11-06T03:30:00.000Z', undefined),
  ],
  next_token: null,
};

const zones = (z0, z1, z2, z3, z4, z5) => ({
  zone_zero_milli: z0 * 60000, zone_one_milli: z1 * 60000, zone_two_milli: z2 * 60000,
  zone_three_milli: z3 * 60000, zone_four_milli: z4 * 60000, zone_five_milli: z5 * 60000,
});

const realShape = (w) => ({
  v1_id: null, created_at: w.start, updated_at: w.end,
  ...w,
  score: w.score ? { kilojoule: 900.2, percent_recorded: 100, distance_meter: null, altitude_gain_meter: null, altitude_change_meter: null, ...w.score } : w.score,
});

const workouts = {
  records: [
    { // 45-min run: zones 1-2 = 10+15 moderate, 3-5 = 10+5+2 vigorous -> 25 + 2*17 = 59
      id: 'w-run', user_id: 10129, sport_id: 0, sport_name: 'running',
      start: '2026-11-07T14:00:00.000Z', end: '2026-11-07T14:45:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { strain: 11.2, average_heart_rate: 150, max_heart_rate: 182, zone_durations: zones(3, 10, 15, 10, 5, 2) },
    },
    { // 35-min lifting session, late evening local Nov 8 (01:30Z Nov 9): strength, dated Nov 8
      id: 'w-lift', user_id: 10129, sport_id: 45, sport_name: 'weightlifting',
      start: '2026-11-09T01:30:00.000Z', end: '2026-11-09T02:05:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { strain: 8.4, zone_durations: zones(10, 15, 8, 2, 0, 0) },
    },
    { // 60 min of "high stress work": zones recorded, but not exercise -> 0
      id: 'w-work', user_id: 10129, sport_id: 101, sport_name: 'high-stress-work',
      start: '2026-11-08T15:00:00.000Z', end: '2026-11-08T16:00:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { zone_durations: zones(0, 30, 20, 10, 0, 0) },
    },
    { // still scoring: no zones yet -> 0 for now
      id: 'w-pending', user_id: 10129, sport_id: 0, sport_name: 'running',
      start: '2026-11-09T12:00:00.000Z', end: '2026-11-09T12:30:00.000Z', timezone_offset: '-05:00',
      score_state: 'PENDING_SCORE',
    },
    { // WHOOP's generic catch-all ("activity", id -1): cardio
      id: 'w-activity', user_id: 10129, sport_id: -1, sport_name: 'activity',
      start: '2026-11-07T20:00:00.000Z', end: '2026-11-07T20:20:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { strain: 4.1, zone_durations: zones(5, 10, 5, 0, 0, 0) },
    },
    { // 8-min walk: under the 10-minute minimum -> 0
      id: 'w-walk', user_id: 10129, sport_id: 63, sport_name: 'walking',
      start: '2026-11-09T15:00:00.000Z', end: '2026-11-09T15:08:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { zone_durations: zones(0, 8, 0, 0, 0, 0) },
    },
  ].map(realShape),
  next_token: null,
};

const profile = { user_id: 10129, email: 'someone@example.com', first_name: 'Test', last_name: 'User' };

module.exports = { cyclesPage1, cyclesPage2, workouts, profile };
