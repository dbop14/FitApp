const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema({
  name: String,
  startDate: String,
  endDate: String,
  stepGoal: Number,
  botName: String,
  botAvatar: String,
  challengeCode: String,
  isPublic: Boolean,
  participants: [String],
  creatorEmail: String,
  admin: String, // Admin/creator user ID (Google ID)
  weighInDay: String,
  matrixRoomId: String,
  photo: String // Challenge profile photo URL
});

module.exports = mongoose.model('Challenge', ChallengeSchema);