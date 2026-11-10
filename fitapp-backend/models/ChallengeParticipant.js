const mongoose = require('mongoose');

const ChallengeParticipantSchema = new mongoose.Schema({
  challengeId: { type: String, required: true },
  userId: { type: String, required: true },
  startingWeight: { type: Number, required: false }, // Optional for future challenges
  lastWeight: { type: Number },
  lastStepDate: { type: Date },
  lastStepPointTimestamp: { type: Date }, // Timestamp when last step point was earned (used to check for new calendar day)
  lastStepCount: { type: Number },
  points: { type: Number, default: 0 },
  stepGoalPoints: { type: Number, default: 0 }, // Track step goal points separately
  weightLossPoints: { type: Number, default: 0 }, // Track weight loss points separately (calculated at challenge end)
  stepGoalDaysAchieved: { type: Number, default: 0 }, // Track total days step goal was achieved

  // Points v2 (additive; absent on Classic participants). Classic fields above keep
  // their Classic meaning. For v2, `weightLossPoints` holds the v2 weight-loss
  // category and `points` mirrors `totalPoints` so existing sorting keeps working.
  scoringMode: { type: String, enum: ['classic', 'v2'] },
  stepPoints: { type: Number },
  goalBonusPoints: { type: Number },
  effortPoints: { type: Number },
  strengthPoints: { type: Number },
  weeklyPoints: { type: Number },
  totalPoints: { type: Number },
  v2ScoredAt: { type: Date },
  // Data source locked for the life of a v2 challenge (set on join).
  lockedSource: { type: String }
});

// Classic code paths load and save participants without knowing the scoring mode.
// For v2 participants, only the v2 engine may change the scored fields; any other
// save keeps their stored values. Classic participants are unaffected.
const V2_PROTECTED_FIELDS = ['points', 'weightLossPoints'];
ChallengeParticipantSchema.post('init', function (doc) {
  doc.$locals.v2Original = Object.fromEntries(V2_PROTECTED_FIELDS.map((f) => [f, doc[f]]));
});
ChallengeParticipantSchema.pre('save', function (next) {
  if (this.scoringMode === 'v2' && !this.isNew && !this.$locals.v2EngineWrite && this.$locals.v2Original) {
    for (const f of V2_PROTECTED_FIELDS) {
      if (this.isModified(f)) this.set(f, this.$locals.v2Original[f]);
    }
  }
  next();
});

// Joining a v2 challenge locks the participant's data source (see
// services/health/sourceLock.js). Done here so every join path gets it.
ChallengeParticipantSchema.pre('save', async function () {
  if (!this.isNew || this.lockedSource) return;
  const Challenge = require('./Challenge');
  const challenge = await Challenge.findById(this.challengeId).select('scoringMode').lean().catch(() => null);
  if (!challenge || challenge.scoringMode !== 'v2') return;
  const User = require('./User');
  const user = await User.findOne({ googleId: this.userId }).select('dataSource oauthType').lean();
  if (!user) return;
  this.scoringMode = 'v2';
  this.lockedSource = require('../services/health/sourceLock').sourceToLock(user);
});

// Add unique compound index to prevent duplicate participants
ChallengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ChallengeParticipant', ChallengeParticipantSchema);