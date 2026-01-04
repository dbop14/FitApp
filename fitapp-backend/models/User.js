const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  picture: String, // Add profile picture field
  steps: Number,
  weight: Number,
  lastSync: Date,
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Number
});

module.exports = mongoose.model('User', UserSchema); 