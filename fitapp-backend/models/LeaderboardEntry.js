const mongoose = require('mongoose');

const LeaderboardEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  challengeId: { type: String, required: true },
  points: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaderboardEntry', LeaderboardEntrySchema);
