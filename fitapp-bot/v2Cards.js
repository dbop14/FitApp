// Points v2 chat cards. The bot never scores anything itself: it reads the
// backend's v2 leaderboard (which recounts with the engine and the one scoring
// config) and decides which cards are due.
//
//   goalBonusCard    once per person per day, when today's steps reach the goal
//   weeklyBonusCard  once per person per week block, when that week's bonus is earned
//
// Classic per-step-point cards are not sent for v2 challenges.

// Weeks whose 7-day block ended more than this many days ago are not announced
// (e.g. right after deploy, or a late sync completing an old week).
const WEEKLY_ANNOUNCE_GRACE_DAYS = 1;

const firstName = (name) => String(name || 'Someone').split(' ')[0];

function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// rows: GET /api/leaderboard/:id for a v2 challenge. Returns cards to send:
// [{ type, userId, picture, message, cardData, weekIndex? }]
function planV2Cards(challenge, rows, { todayYmd, weekLengthDays = 7 }) {
  const cards = [];
  for (const row of rows || []) {
    const name = firstName(row.name);
    const today = row.today;
    if (today && today.date === todayYmd && today.goalBonusPoints > 0) {
      const steps = today.steps ?? 0;
      cards.push({
        type: 'goalBonusCard',
        userId: row.userId,
        picture: row.picture,
        message: `${name} hit the ${Number(row.stepGoal || 0).toLocaleString()}-step goal today: +${fmt(today.goalBonusPoints)} bonus points!`,
        cardData: {
          userName: name,
          stepCount: steps,
          stepGoal: row.stepGoal,
          points: today.goalBonusPoints,
          achievement: 'Daily Goal Bonus',
          date: todayYmd,
        },
      });
    }
    for (const week of row.weeks || []) {
      if (!(week.points > 0)) continue;
      const weekEnd = addDays(week.startDate, weekLengthDays - 1);
      if (weekEnd < addDays(todayYmd, -WEEKLY_ANNOUNCE_GRACE_DAYS) || week.startDate > todayYmd) continue;
      cards.push({
        type: 'weeklyBonusCard',
        userId: row.userId,
        picture: row.picture,
        weekIndex: week.index,
        message: `${name} was active ${week.activeDays} days in week ${week.index + 1}: +${fmt(week.points)} weekly bonus!`,
        cardData: {
          userName: name,
          weekIndex: week.index, // 0-based, as the engine reports it
          weekNumber: week.index + 1,
          activeDays: week.activeDays,
          points: week.points,
          achievement: 'Weekly Consistency Bonus',
        },
      });
    }
  }
  return cards;
}

// Winner message for a v2 challenge from the top leaderboard row.
function v2WinnerMessage(challenge, row) {
  const b = row.breakdown || {};
  const name = firstName(row.name);
  const lines = [
    `Challenge Complete! The winner of ${challenge.name} is ${name} with ${fmt(row.totalPoints)} total points!`,
    '',
    'Breakdown:',
    `- Steps: ${fmt(b.steps || 0)}`,
    `- Daily goal bonus: ${fmt(b.goalBonus || 0)}`,
    `- Effort: ${fmt(b.effort || 0)}`,
    `- Strength: ${fmt(b.strength || 0)}`,
    `- Weekly bonus: ${fmt(b.weekly || 0)}`,
    `- Weight loss: ${fmt(b.weightLoss || 0)}`,
    '',
    'Congratulations on your dedication and hard work!',
  ];
  return {
    message: lines.join('\n'),
    cardData: {
      userName: name,
      totalPoints: row.totalPoints,
      breakdown: b,
      weightLossPoints: b.weightLoss || 0,
      challengeName: challenge.name,
      scoringMode: 'v2',
    },
  };
}

module.exports = { planV2Cards, v2WinnerMessage, addDays, WEEKLY_ANNOUNCE_GRACE_DAYS };
