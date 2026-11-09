const { test } = require('node:test');
const assert = require('node:assert/strict');
const V2 = require('../config/scoringV2');
const { scoreChallengeV2, effortPointsForWorkout, dayNumber, fromDayNumber } = require('../services/scoring/scoreChallengeV2');

const START = '2026-01-05'; // a Monday

const FIXTURES = {
  casual:    { week: [[6500,15,0],[6000,10,0],[7000,20,1],[6500,10,0],[6000,15,0],[8000,25,0],[5500,5,0]], weightLossPct: 0.5, expectedTotal: 268 },
  committed: { week: [[10500,40,1],[11000,45,0],[10000,30,1],[9500,35,0],[11500,50,1],[12000,60,0],[8000,20,0]], weightLossPct: 1.5, expectedTotal: 540 },
  endurance: { week: [[16000,120,0],[18000,130,1],[15000,100,0],[17000,110,1],[14000,90,0],[22000,160,0],[9000,40,1]], weightLossPct: 0.5, expectedTotal: 658 },
  lifter:    { week: [[5000,25,1],[4500,5,0],[5500,30,1],[5000,5,0],[5000,28,1],[6000,20,1],[4000,0,0]], weightLossPct: 0.8, expectedTotal: 265.2 },
  grinder:   { week: [[30000,10,0],[30000,10,0],[30000,10,0],[30000,10,0],[30000,10,0],[30000,10,0],[30000,10,0]], weightLossPct: 0, expectedTotal: 440 },
  perfect:   { week: [[14000,150,1],[14000,150,1],[14000,150,1],[14000,150,1],[14000,150,1],[14000,150,1],[14000,150,1]], weightLossPct: 3.0, expectedTotal: 760 },
};

const addDays = (ymd, n) => fromDayNumber(dayNumber(ymd) + n);

function build(week, { weeks = 4, weightLossPct = 0, stepGoal = 10000, startingWeight = 200 } = {}) {
  const days = [];
  for (let w = 0; w < weeks; w++) {
    week.forEach(([steps, effortPoints, strengthSessions], i) => {
      days.push({ date: addDays(START, w * 7 + i), steps, effortPoints, strengthSessions });
    });
  }
  const end = addDays(START, weeks * 7 - 1);
  const weighIns = [{ date: end, weight: startingWeight * (1 - weightLossPct / 100) }];
  const config = { ...V2, stepGoal, startDate: START, endDate: end, startingWeight, asOf: addDays(end, 10), timeZone: 'America/New_York' };
  return { days, weighIns, config };
}

for (const [name, f] of Object.entries(FIXTURES)) {
  test(`fixture "${name}" totals ${f.expectedTotal}`, () => {
    const { days, weighIns, config } = build(f.week, { weightLossPct: f.weightLossPct });
    const r = scoreChallengeV2(days, weighIns, config);
    assert.equal(r.total, f.expectedTotal, JSON.stringify(r.categories));
  });
}

test('"perfect" is the 28-day ceiling: 28 x 22 daily + 64 strength + 20 weekly + 60 weight', () => {
  const { days, weighIns, config } = build(FIXTURES.perfect.week, { weightLossPct: 3 });
  const r = scoreChallengeV2(days, weighIns, config);
  assert.deepEqual(r.categories, { steps: 336, goalBonus: 56, effort: 224, strength: 64, weekly: 20, weightLoss: 60 });
});

test('stepGoal 8,000 caps steps at 10 points and moves the goal bonus', () => {
  const { days, config } = build([[14000, 0, 0], [8000, 0, 0], [7999, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], { weeks: 1, stepGoal: 8000 });
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.days[0].stepPoints, 10);
  assert.equal(r.days[0].goalBonusPoints, 2);
  assert.equal(r.days[1].stepPoints, 8);
  assert.equal(r.days[1].goalBonusPoints, 2);
  assert.equal(r.days[2].stepPoints, 7.9);
  assert.equal(r.days[2].goalBonusPoints, 0);
});

test('a null step day scores as no data and stays provisional', () => {
  const { days, config } = build([[null, 0, 0], [12000, 0, 0], [6000, 0, 0], [6000, 0, 0], [6000, 0, 0], [6000, 0, 0], [6000, 0, 0]], { weeks: 1 });
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.days[0].steps, null);
  assert.equal(r.days[0].stepPoints, 0);
  assert.equal(r.days[0].goalBonusPoints, 0);
  assert.equal(r.days[0].active, false);
  assert.equal(r.days[0].provisional, true);
  assert.equal(r.days[1].provisional, false);
});

test('a missing day is the same as a null step day', () => {
  const { days, config } = build([[12000, 0, 0]], { weeks: 1 });
  config.endDate = addDays(START, 2);
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.days.length, 3);
  assert.equal(r.days[1].steps, null);
  assert.equal(r.days[1].provisional, true);
});

test('a weight gain scores 0, never negative', () => {
  const { days, weighIns, config } = build(FIXTURES.casual.week, { weightLossPct: -2 });
  const r = scoreChallengeV2(days, weighIns, config);
  assert.equal(r.categories.weightLoss, 0);
});

test('weight loss is capped at 0.75% per elapsed week', () => {
  // Day 10 of a challenge: weeksElapsed = ceil(10/7) = 2 -> cap 1.5%.
  const config = { ...V2, stepGoal: 10000, startDate: START, endDate: addDays(START, 27), startingWeight: 200, asOf: addDays(START, 9) };
  const r = scoreChallengeV2([], [{ date: addDays(START, 7), weight: 190 }], config); // 5% lost
  assert.equal(r.weight.countedPct, 1.5);
  assert.equal(r.categories.weightLoss, 30);
});

test('a 6th strength session in one week is ignored (4 per week, 1 per day)', () => {
  const week = [[0, 0, 1], [0, 0, 2], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 0]];
  const { days, config } = build(week, { weeks: 1 });
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.categories.strength, 16);
  assert.deepEqual(r.days.map((d) => d.strengthSessionsCounted), [1, 1, 1, 1, 0, 0, 0]);
  // Uncounted strength sessions do not make a day active.
  assert.equal(r.days[4].active, false);
});

test('a 5-week challenge scores five weekly blocks and caps weight at 3.75%', () => {
  const { days, weighIns, config } = build(FIXTURES.perfect.week, { weeks: 5, weightLossPct: 5 });
  const r = scoreChallengeV2(days, weighIns, config);
  assert.equal(r.weeks.length, 5);
  assert.equal(r.categories.weekly, 25);
  assert.equal(r.categories.strength, 80);
  assert.equal(r.categories.weightLoss, 75);
  assert.equal(r.total, 35 * 22 + 80 + 25 + 75);
});

test('days after asOf are not scored; recent days are provisional for 48 hours', () => {
  const { days, config } = build(FIXTURES.committed.week, { weeks: 1 });
  config.asOf = addDays(START, 3); // end of day 4
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.days.length, 4);
  assert.deepEqual(r.days.map((d) => d.provisional), [false, false, true, true]);
  // finalized days are never provisional
  days[3].finalized = true;
  assert.equal(scoreChallengeV2(days, [], config).days[3].provisional, false);
});

test('effort points come only from workouts of 10+ minutes (1 moderate, 2 vigorous)', () => {
  const start = '2026-01-05T10:00:00Z';
  assert.equal(effortPointsForWorkout({ start, end: '2026-01-05T10:09:00Z', moderateMinutes: 9 }, V2), 0);
  assert.equal(effortPointsForWorkout({ start, end: '2026-01-05T10:30:00Z', moderateMinutes: 10, vigorousMinutes: 15 }, V2), 40);
});

test('the daily effort cap is 8 points', () => {
  const { days, config } = build([[0, 500, 0]], { weeks: 1 });
  const r = scoreChallengeV2(days, [], config);
  assert.equal(r.days[0].effortPoints, 8);
});
