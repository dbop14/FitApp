const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planV2Cards, v2WinnerMessage } = require('../v2Cards');

const challenge = { name: 'Winter v2', stepGoal: 10000 };
const row = (over = {}) => ({
  userId: 'u1', name: 'Dana Smith', picture: 'p.png', stepGoal: 10000, scoringMode: 'v2',
  today: { date: '2026-11-20', steps: 10400, goalBonusPoints: 2 },
  weeks: [
    { index: 0, startDate: '2026-11-02', activeDays: 6, points: 5 }, // ended Nov 8: too old
    { index: 1, startDate: '2026-11-09', activeDays: 5, points: 5 }, // ended Nov 15: too old
    { index: 2, startDate: '2026-11-16', activeDays: 5, points: 5 }, // current week
  ],
  ...over,
});

test('goal bonus card only for today, only when earned', () => {
  const cards = planV2Cards(challenge, [row()], { todayYmd: '2026-11-20' });
  const goal = cards.filter((c) => c.type === 'goalBonusCard');
  assert.equal(goal.length, 1);
  assert.equal(goal[0].message, 'Dana hit the 10,000-step goal today: +2 bonus points!');
  assert.equal(goal[0].cardData.points, 2);
  assert.equal(planV2Cards(challenge, [row({ today: { date: '2026-11-20', steps: 9000, goalBonusPoints: 0 } })], { todayYmd: '2026-11-20' })
    .filter((c) => c.type === 'goalBonusCard').length, 0);
  assert.equal(planV2Cards(challenge, [row({ today: { date: '2026-11-19', steps: 12000, goalBonusPoints: 2 } })], { todayYmd: '2026-11-20' })
    .filter((c) => c.type === 'goalBonusCard').length, 0, 'not for another day');
});

test('weekly card for the current or just-ended week only, numbered from 1', () => {
  const weekly = planV2Cards(challenge, [row()], { todayYmd: '2026-11-20' }).filter((c) => c.type === 'weeklyBonusCard');
  assert.deepEqual(weekly.map((c) => c.weekIndex), [2]);
  assert.equal(weekly[0].message, 'Dana was active 5 days in week 3: +5 weekly bonus!');
  // The day after week 2 (index 1) ends, it can still be announced.
  const dayAfter = planV2Cards(challenge, [row()], { todayYmd: '2026-11-16' }).filter((c) => c.type === 'weeklyBonusCard');
  assert.deepEqual(dayAfter.map((c) => c.weekIndex).sort(), [1, 2]);
});

test('no weekly card for weeks without the bonus', () => {
  const cards = planV2Cards(challenge, [row({ weeks: [{ index: 2, startDate: '2026-11-16', activeDays: 4, points: 0 }] })], { todayYmd: '2026-11-20' });
  assert.equal(cards.filter((c) => c.type === 'weeklyBonusCard').length, 0);
});

test('winner message uses total points and the v2 breakdown', () => {
  const { message, cardData } = v2WinnerMessage(challenge, {
    name: 'Dana Smith', totalPoints: 251.4,
    breakdown: { steps: 180.2, goalBonus: 30, effort: 21.2, strength: 8, weekly: 10, weightLoss: 2 },
  });
  assert.match(message, /winner of Winter v2 is Dana with 251\.4 total points/);
  assert.match(message, /- Effort: 21\.2/);
  assert.equal(cardData.totalPoints, 251.4);
  assert.equal(cardData.scoringMode, 'v2');
});
