// Google Health API v4 responses, built from the documented schema
// (developers.google.com/health/reference/rest/v4). Replace with recorded
// responses once a real account is connected; keep the same export names.

const steps = {
  rollupDataPoints: [
    { civilStartTime: { date: { year: 2026, month: 11, day: 7 } }, civilEndTime: { date: { year: 2026, month: 11, day: 8 } }, steps: { countSum: '11250' } },
    { civilStartTime: { date: { year: 2026, month: 11, day: 8 } }, civilEndTime: { date: { year: 2026, month: 11, day: 9 } }, steps: { countSum: '4321' } },
    // 2026-11-09: no rollup point yet (no data)
  ],
};

const weight = {
  dataPoints: [
    { name: 'users/me/dataTypes/weight/dataPoints/2', weight: { sampleTime: { physicalTime: '2026-11-08T12:30:00Z' }, weightGrams: 88450 } },
    { name: 'users/me/dataTypes/weight/dataPoints/1', weight: { sampleTime: { physicalTime: '2026-11-08T03:30:00Z' }, weightGrams: 88900 } }, // 22:30 Nov 7 in New York
  ],
};

const exercise = {
  dataPoints: [
    { // 45-minute run: 20 moderate + 15 vigorous + 2 peak minutes -> 20 + 2*17 = 54 effort points
      name: 'users/me/dataTypes/exercise/dataPoints/a',
      exercise: {
        interval: { startTime: '2026-11-07T14:00:00Z', endTime: '2026-11-07T14:45:00Z', civilStartTime: { date: { year: 2026, month: 11, day: 7 } } },
        exerciseType: 'RUNNING',
        displayName: 'Run',
        metricsSummary: { heartRateZoneDurations: { lightTime: '480s', moderateTime: '1200s', vigorousTime: '900s', peakTime: '120s' }, activeZoneMinutes: '54' },
      },
    },
    { // 30-minute weights session, no zone split -> falls back to activeZoneMinutes; counts as strength
      name: 'users/me/dataTypes/exercise/dataPoints/b',
      exercise: {
        interval: { startTime: '2026-11-08T22:00:00Z', endTime: '2026-11-08T22:30:00Z' },
        exerciseType: 'WEIGHTLIFTING',
        displayName: 'Weights',
        metricsSummary: { activeZoneMinutes: '12' },
      },
    },
    { // 8-minute walk: under 10 minutes, no effort points
      name: 'users/me/dataTypes/exercise/dataPoints/c',
      exercise: {
        interval: { startTime: '2026-11-08T16:00:00Z', endTime: '2026-11-08T16:08:00Z' },
        exerciseType: 'WALKING',
        displayName: 'Walk',
        metricsSummary: { heartRateZoneDurations: { moderateTime: '480s' } },
      },
    },
    { // 15-minute strength session: too short to count as strength (20+), still earns effort
      name: 'users/me/dataTypes/exercise/dataPoints/d',
      exercise: {
        interval: { startTime: '2026-11-09T13:00:00Z', endTime: '2026-11-09T13:15:00Z' },
        exerciseType: 'STRENGTH_TRAINING',
        displayName: 'Strength',
        metricsSummary: { heartRateZoneDurations: { moderateTime: '600s', vigorousTime: '0s' } },
      },
    },
  ],
};

module.exports = { steps, weight, exercise };
