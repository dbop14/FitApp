const mongoose = require('mongoose');

const ChallengeParticipantSchema = new mongoose.Schema({
  challengeId: { type: String, required: true },
  userId: { type: String, required: true },
  startingWeight: { type: Number, required: false }, // Optional for future challenges
  lastWeight: { type: Number },
  lastStepDate: { type: Date },
  lastStepPointTimestamp: { type: Date }, // Timestamp when last step point was earned (for 24-hour window)
  lastStepCount: { type: Number },
  points: { type: Number, default: 0 },
  stepGoalPoints: { type: Number, default: 0 }, // Track step goal points separately
  weightLossPoints: { type: Number, default: 0 }, // Track weight loss points separately (calculated at challenge end)
  stepGoalDaysAchieved: { type: Number, default: 0 } // Track total days step goal was achieved
});

// Add unique compound index to prevent duplicate participants
ChallengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ChallengeParticipant', ChallengeParticipantSchema);