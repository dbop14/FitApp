// Source lock for Points v2: a participant's health data source is fixed when
// they join a v2 challenge and stays fixed until that challenge ends, so nobody
// can switch to whichever source reports more.
//
// One exception: legacy sources that are shutting down (fitbit: gone since
// 2026-10-30; google-fit: ends 2026) may move once to google-health, which
// replaces both. The lock then moves with them.

const ChallengeParticipant = require('../../models/ChallengeParticipant');
const Challenge = require('../../models/Challenge');
const { getHealthSourceName } = require('./index');
const { toYmd } = require('../scoring/recountV2');

const UPGRADES = { fitbit: ['google-health'], 'google-fit': ['google-health'] };

const LABELS = { 'google-health': 'Google Health', 'google-fit': 'Google Fit', fitbit: 'Fitbit', whoop: 'WHOOP' };
const sourceLabel = (s) => LABELS[s] || s;

// v2 challenges this user is locked into that have not ended (including ones not started yet).
async function getActiveLocks(googleId, now = new Date()) {
  const parts = await ChallengeParticipant.find({ userId: googleId, lockedSource: { $exists: true, $ne: null } })
    .select('challengeId lockedSource').lean();
  if (parts.length === 0) return [];
  const today = toYmd(now);
  const challenges = await Challenge.find({ _id: { $in: parts.map((p) => p.challengeId) } })
    .select('name endDate scoringMode').lean();
  const byId = new Map(challenges.map((c) => [String(c._id), c]));
  const locks = [];
  for (const p of parts) {
    const c = byId.get(String(p.challengeId));
    if (!c || c.scoringMode !== 'v2') continue;
    const end = c.endDate ? String(c.endDate).slice(0, 10) : null;
    if (end && end < today) continue;
    locks.push({ challengeId: String(c._id), challengeName: c.name, lockedSource: p.lockedSource });
  }
  return locks;
}

// May this user make `toSource` their active source?
// -> { ok, locks, upgrade, message }
async function checkSwitch(googleId, toSource, now = new Date()) {
  const locks = await getActiveLocks(googleId, now);
  const blocking = locks.filter((l) => l.lockedSource !== toSource && !(UPGRADES[l.lockedSource] || []).includes(toSource));
  if (blocking.length) {
    const l = blocking[0];
    return {
      ok: false,
      locks,
      message: `Your data source is locked to ${sourceLabel(l.lockedSource)} until "${l.challengeName}" ends.`,
    };
  }
  const upgrade = locks.some((l) => l.lockedSource !== toSource);
  return { ok: true, locks, upgrade };
}

// After an allowed upgrade, move the lock on every active challenge to the new source.
async function moveLocks(googleId, toSource, now = new Date()) {
  const locks = await getActiveLocks(googleId, now);
  const ids = locks.filter((l) => l.lockedSource !== toSource && (UPGRADES[l.lockedSource] || []).includes(toSource))
    .map((l) => l.challengeId);
  if (ids.length === 0) return 0;
  const res = await ChallengeParticipant.updateMany(
    { userId: googleId, challengeId: { $in: ids } },
    { $set: { lockedSource: toSource } },
  );
  return res.modifiedCount || 0;
}

// Is `source` the locked source of an active v2 challenge for this user?
async function isLockedTo(googleId, source, now = new Date()) {
  return (await getActiveLocks(googleId, now)).some((l) => l.lockedSource === source);
}

// The source to record for a user joining a v2 challenge.
function sourceToLock(user) {
  return getHealthSourceName(user);
}

module.exports = { getActiveLocks, checkSwitch, moveLocks, isLockedTo, sourceToLock, sourceLabel, UPGRADES };
