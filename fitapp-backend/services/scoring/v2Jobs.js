// Scheduled jobs for Points v2 (wired up in index.js):
//
//   morningBackfill  06:30  re-pull the previous 2 days (plus today) for every
//                           participant of a running v2 challenge, so late
//                           syncs from watches and phones land before days
//                           finalize; then finalize and recount.
//   finalizePass     00:30  lock days that ended 48h+ ago, then recount.
//
// The 23:55 pull and the 00:00 reset are unchanged.

const Challenge = require('../../models/Challenge');
const ChallengeParticipant = require('../../models/ChallengeParticipant');
const User = require('../../models/User');
const health = require('../health');
const { recountV2Challenge, finalizeV2Days, toYmd, isV2 } = require('./recountV2');

const BACKFILL_DAYS = 3; // today + the previous 2 days

// v2 challenges that have started and ended no more than 3 days ago (late data
// for the last days can still arrive until they finalize).
async function runningV2Challenges(now = new Date()) {
  const today = toYmd(now);
  const all = await Challenge.find({ scoringMode: 'v2' });
  return all.filter((c) => {
    if (!isV2(c) || !c.startDate) return false;
    const start = String(c.startDate).slice(0, 10);
    const end = c.endDate ? String(c.endDate).slice(0, 10) : null;
    const graceEnd = end ? new Date(Date.parse(`${end}T12:00:00Z`) + BACKFILL_DAYS * 86400000).toISOString().slice(0, 10) : null;
    return start <= today && (!graceEnd || graceEnd >= today);
  });
}

async function syncUser(user, now, deps) {
  if (health.getHealthSource(user)) {
    await health.syncHealthHistory(user, { days: BACKFILL_DAYS, now });
    return 'synced';
  }
  if (health.isServerSource(user)) return 'skipped'; // switched off or disconnected
  if ((user.dataSource || 'google-fit') === 'google-fit' && user.accessToken) {
    await deps.syncGoogleFit(user, BACKFILL_DAYS);
    return 'synced';
  }
  return 'skipped'; // fitbit (shut down) or no tokens
}

async function morningBackfill({ now = new Date(), deps } = {}) {
  const d = deps || { syncGoogleFit: require('../../scripts/backfillStepHistoryAndPoints').syncGoogleFitHistoryForUser };
  const challenges = await runningV2Challenges(now);
  const userIds = new Set();
  for (const c of challenges) {
    const ps = await ChallengeParticipant.find({ challengeId: c._id.toString() }).select('userId').lean();
    ps.forEach((p) => userIds.add(p.userId));
  }
  const summary = { challenges: challenges.length, users: userIds.size, synced: 0, skipped: 0, failed: 0, finalized: 0 };
  for (const googleId of userIds) {
    const user = await User.findOne({ googleId });
    if (!user) continue;
    try {
      summary[await syncUser(user, now, d)]++;
    } catch (err) {
      summary.failed++;
      console.error(`❌ v2 morning backfill failed for ${googleId}: ${err.message}`);
    }
  }
  summary.finalized = await finalizeV2Days(challenges, { asOf: now });
  for (const c of challenges) await recountV2Challenge(c, { asOf: now });
  return summary;
}

async function finalizePass({ now = new Date() } = {}) {
  const challenges = await runningV2Challenges(now);
  const finalized = await finalizeV2Days(challenges, { asOf: now });
  for (const c of challenges) await recountV2Challenge(c, { asOf: now });
  return { challenges: challenges.length, finalized };
}

module.exports = { morningBackfill, finalizePass, runningV2Challenges, BACKFILL_DAYS };
