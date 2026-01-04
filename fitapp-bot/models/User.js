const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: String, // Add googleId to match backend model
  sub: String,
  name: String,
  email: String,
  picture: String,
  steps: Number,
  weight: Number,
  lastSync: Date
});

module.exports = mongoose.model('User', UserSchema); 