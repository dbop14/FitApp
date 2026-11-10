// Google Health API v4 responses. Shapes were checked against a real dev
// account on 2026-11-10 (steps dailyRollUp, weight and exercise lists, and
// heart-rate samples). Values and IDs here are made up: no real user's health
// data is stored in the repo.
//
// What the real account showed:
// - dailyRollUp omits days with no data; countSum is a string.
// - weight/exercise/heart-rate lists come newest first; points carry
//   dataSource { recordingMethod, application.packageName, platform }.
// - Workouts synced from Apple Health (e.g. Whoop) have no civilStartTime, no
//   heartRateZoneDurations and no activeZoneMinutes: only startUtcOffset,
//   averageHeartRateBeatsPerMinute (string) and activeDuration. Effort Points
//   for those come from heart-rate samples and the user's max heart rate.
// - Exercise can only be filtered on exercise.interval.civil_start_time.

const steps = {
  rollupDataPoints: [
    { civilStartTime: { date: { year: 2026, month: 11, day: 7 } }, civilEndTime: { date: { year: 2026, month: 11, day: 8 } }, steps: { countSum: '11250' } },
    { civilStartTime: { date: { year: 2026, month: 11, day: 8 } }, civilEndTime: { date: { year: 2026, month: 11, day: 9 } }, steps: { countSum: '4321' } },
    // 2026-11-09: no rollup point yet (no data)
  ],
};

const weight = {
  dataPoints: [
    { name: 'users/me/dataTypes/weight/dataPoints/2', dataSource: { recordingMethod: 'MANUAL', application: { packageName: 'com.apple.Health' }, platform: 'HEALTH_KIT' }, weight: { sampleTime: { physicalTime: '2026-11-08T12:30:00Z' }, weightGrams: 88450 } },
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
    { // Recorded shape: walk synced from Whoop through Apple Health. 18:07-18:55 New York.
      // Heart-rate samples below give 20 moderate + 10 vigorous minutes at max HR 185.
      name: 'users/1234567890/dataTypes/exercise/dataPoints/111',
      dataSource: { recordingMethod: 'UNKNOWN', application: { packageName: 'com.whoop.iphone' }, platform: 'HEALTH_KIT' },
      exercise: {
        interval: { startTime: '2026-11-05T23:07:00.428Z', startUtcOffset: '-18000s', endTime: '2026-11-05T23:54:59.537Z', endUtcOffset: '-18000s' },
        exerciseType: 'WALKING',
        metricsSummary: { caloriesKcal: 420, averageHeartRateBeatsPerMinute: '134' },
        exerciseMetadata: {},
        displayName: 'Walk',
        activeDuration: '2879.109s',
        updateTime: '2026-11-10T16:38:52.171025Z',
        createTime: '2026-11-10T16:38:52.171025Z',
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

// Heart-rate samples every 10 s during the recorded-shape walk: 18 min at 100 bpm
// (below moderate), 20 min at 130 (moderate), 10 min at 150 (vigorous) for max HR 185.
const heartRatePoints = [];
for (let i = 0; i < 48 * 6; i++) {
  const t = new Date(Date.parse('2026-11-05T23:07:00Z') + i * 10000);
  const bpm = i < 18 * 6 ? 100 : i < 38 * 6 ? 130 : 150;
  heartRatePoints.push({
    dataSource: { recordingMethod: 'UNKNOWN', application: { packageName: 'com.whoop.iphone' }, platform: 'HEALTH_KIT' },
    heartRate: { sampleTime: { physicalTime: t.toISOString(), utcOffset: '-18000s' }, beatsPerMinute: String(bpm) },
  });
}
const heartRate = { dataPoints: heartRatePoints.reverse() }; // newest first, like the API

module.exports = { steps, weight, exercise, heartRate };
