// WHOOP API v2 responses built from the documented samples
// (developer.whoop.com/api). Not yet checked against a real account: replace
// with recorded shapes (made-up values) once a WHOOP login is connected on dev.

// Cycles, newest first. Offsets are New York (EST, -05:00).
const cyclesPage1 = {
  records: [
    { // current cycle: started 06:30 local Nov 9, still open, steps so far
      id: 93845, user_id: 10129, start: '2026-11-09T11:30:00.000Z', end: null,
      timezone_offset: '-05:00', score_state: 'PENDING_SCORE', step_count: 4100,
    },
    { // started 23:40 local Nov 7 (04:40Z Nov 8): credited to Nov 7
      id: 93844, user_id: 10129, start: '2026-11-08T04:40:00.000Z', end: '2026-11-09T11:30:00.000Z',
      timezone_offset: '-05:00', score_state: 'SCORED',
      score: { strain: 12.1, kilojoule: 9800, average_heart_rate: 68, max_heart_rate: 171 },
      step_count: 11250,
    },
  ],
  next_token: 'page2',
};
const cyclesPage2 = {
  records: [
    { // a short second cycle starting the same local day (Nov 7, 07:00 local): summed
      id: 93843, user_id: 10129, start: '2026-11-07T12:00:00.000Z', end: '2026-11-08T04:40:00.000Z',
      timezone_offset: '-05:00', score_state: 'SCORED', step_count: 750,
    },
    { // no step_count reported: ignored (no data)
      id: 93842, user_id: 10129, start: '2026-11-06T12:00:00.000Z', end: '2026-11-07T12:00:00.000Z',
      timezone_offset: '-05:00', score_state: 'SCORED',
    },
  ],
  next_token: null,
};

const zones = (z0, z1, z2, z3, z4, z5) => ({
  zone_zero_milli: z0 * 60000, zone_one_milli: z1 * 60000, zone_two_milli: z2 * 60000,
  zone_three_milli: z3 * 60000, zone_four_milli: z4 * 60000, zone_five_milli: z5 * 60000,
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
    { // 8-min walk: under the 10-minute minimum -> 0
      id: 'w-walk', user_id: 10129, sport_id: 63, sport_name: 'walking',
      start: '2026-11-09T15:00:00.000Z', end: '2026-11-09T15:08:00.000Z', timezone_offset: '-05:00',
      score_state: 'SCORED', score: { zone_durations: zones(0, 8, 0, 0, 0, 0) },
    },
  ],
  next_token: null,
};

const profile = { user_id: 10129, email: 'someone@example.com', first_name: 'Test', last_name: 'User' };

module.exports = { cyclesPage1, cyclesPage2, workouts, profile };
