// Database glue for Points v2: loads FitnessHistory, runs the pure engine and
// stores the breakdown on ChallengeParticipant. Classic challenges never come here.

const ChallengeParticipant = require('../../models/ChallengeParticipant');
const FitnessHistory = require('../../models/FitnessHistory');
const SCORING_V2 = require('../../config/scoringV2');
const { scoreChallengeV2, dayNumber, fromDayNumber } = require('./scoreChallengeV2');

const APP_TIMEZONE = () => process.env.APP_TIMEZONE || 'America/New_York';

// FitnessHistory.date is local midnight; read it as a calendar day in APP_TIMEZONE.
function toYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE(), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(date));
}

function weekdayName(ymd) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date(dayNumber(ymd) * 86400000).getUTCDay()
  ];
}

// Local-midnight Date for a 'YYYY-MM-DD' (matches FitnessHistory.normalizeDate).
function ymdToLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isV2(challenge) {
  return Boolean(challenge && challenge.scoringMode === 'v2');
}

function buildConfig(challenge, participant, asOf) {
  return {
    ...SCORING_V2,
    timeZone: APP_TIMEZONE(),
    stepGoal: challenge.stepGoal,
    startDate: String(challenge.startDate).slice(0, 10),
    endDate: challenge.endDate ? String(challenge.endDate).slice(0, 10) : null,
    startingWeight: participant.startingWeight || null,
    asOf: asOf.toISOString(),
  };
}

// FitnessHistory rows -> engine input.
function historyToEngineInput(history, challenge) {
  const days = [];
  const weighIns = [];
  const weighInDay = challenge.weighInDay ? String(challenge.weighInDay).toLowerCase() : null;
  for (const h of history) {
    const date = toYmd(h.date);
    // A weight-only manual row has steps defaulted to 0; that is "no step data", not zero.
    const weightOnly = h.source === 'manual' && !h.steps && !h.effortPoints && !h.strengthSessions;
    days.push({
      date,
      steps: h.steps === null || h.steps === undefined || weightOnly ? null : h.steps,
      effortPoints: h.effortPoints || 0,
      strengthSessions: h.strengthSessions || 0,
      finalized: Boolean(h.finalized),
    });
    if (h.weight > 0 && (!weighInDay || weekdayName(date) === weighInDay)) {
      weighIns.push({ date, weight: h.weight });
    }
  }
  return { days, weighIns };
}

async function scoreParticipant(challenge, participant, asOf = new Date()) {
  const config = buildConfig(challenge, participant, asOf);
  const start = ymdToLocalDate(config.startDate);
  const end = config.endDate ? ymdToLocalDate(config.endDate) : asOf;
  const history = await FitnessHistory.find({ userId: participant.userId, date: { $gte: start, $lte: end } })
    .sort({ date: 1 })
    .lean();
  const { days, weighIns } = historyToEngineInput(history, challenge);
  return scoreChallengeV2(days, weighIns, config);
}

const FIELD_MAP = (r) => ({
  scoringMode: 'v2',
  stepPoints: r.categories.steps,
  goalBonusPoints: r.categories.goalBonus,
  effortPoints: r.categories.effort,
  strengthPoints: r.categories.strength,
  weeklyPoints: r.categories.weekly,
  weightLossPoints: r.categories.weightLoss,
  totalPoints: r.total,
  points: r.total,
});

// Score and store one participant. Returns the engine result.
async function recountV2Participant(challenge, participant, asOf = new Date()) {
  const result = await scoreParticipant(challenge, participant, asOf);
  const fields = FIELD_MAP(result);
  const changed = Object.entries(fields).some(([k, v]) => participant[k] !== v);
  if (changed) {
    participant.$locals.v2EngineWrite = true;
    participant.set({ ...fields, v2ScoredAt: asOf });
    await participant.save();
    participant.$locals.v2EngineWrite = false;
  }
  return result;
}

// Score every participant of a v2 challenge. Returns [{ participant, result }].
async function recountV2Challenge(challenge, { asOf = new Date() } = {}) {
  if (!isV2(challenge)) return [];
  const participants = await ChallengeParticipant.find({ challengeId: challenge._id.toString() });
  const out = [];
  for (const participant of participants) {
    out.push({ participant, result: await recountV2Participant(challenge, participant, asOf) });
  }
  return out;
}

// Finalize pass: lock days that ended FINALIZE_AFTER_HOURS ago for users in the
// given v2 challenges. Days with no step data stay provisional.
async function finalizeV2Days(challenges, { asOf = new Date() } = {}) {
  const v2 = (challenges || []).filter(isV2);
  if (v2.length === 0) return 0;
  const userIds = new Set();
  for (const c of v2) {
    const ps = await ChallengeParticipant.find({ challengeId: c._id.toString() }).select('userId').lean();
    ps.forEach((p) => userIds.add(p.userId));
  }
  if (userIds.size === 0) return 0;
  // Day D is final once D+1 00:00 + 48h has passed, i.e. D <= today - 3.
  const todayN = dayNumber(toYmd(asOf));
  const daysAfter = Math.ceil(SCORING_V2.FINALIZE_AFTER_HOURS / 24) + 1;
  const cutoff = ymdToLocalDate(fromDayNumber(todayN - daysAfter + 1)); // exclusive
  const res = await FitnessHistory.updateMany(
    {
      userId: { $in: [...userIds] },
      date: { $lt: cutoff },
      finalized: { $ne: true },
      steps: { $ne: null },
      source: { $ne: 'manual' },
    },
    { $set: { finalized: true } },
  );
  return res.modifiedCount || 0;
}

module.exports = {
  isV2,
  scoreParticipant,
  recountV2Participant,
  recountV2Challenge,
  finalizeV2Days,
  historyToEngineInput,
  toYmd,
};
