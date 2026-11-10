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
  tokenExpiry: Number,
  dataSource: { type: String, enum: ['google-fit', 'fitbit', 'google-health', 'whoop'], default: 'google-fit' },
  fitbitAccessToken: String,
  fitbitRefreshToken: String,
  fitbitTokenExpiry: Number,
  fitbitUserId: String,

  // Google Health API (additive). oauthType says which health integration the user
  // is on: unset/'fitbit' = legacy Fitbit or Google Fit, 'google' = Google Health.
  // These tokens are separate from the sign-in tokens above.
  oauthType: { type: String, enum: ['fitbit', 'google'] },
  googleHealthAccessToken: String,
  googleHealthRefreshToken: String,
  googleHealthTokenExpiry: Number,
  googleHealthConnectedAt: Date,
  googleHealthLastError: String, // e.g. 'invalid_grant' when the user must reconnect
  maxHeartRate: Number, // Effort Points fallback; unset means config DEFAULT_MAX_HR
  // WHOOP (dataSource 'whoop'). Refresh tokens rotate on every refresh.
  whoopAccessToken: String,
  whoopRefreshToken: String,
  whoopTokenExpiry: Number,
  whoopUserId: String,
  whoopConnectedAt: Date,
  whoopLastError: String, // e.g. 'invalid_grant' when the user must reconnect
  whoopOAuthState: String, // 8-character nonce for the connect redirect
  whoopOAuthStateExpiry: Date
});

module.exports = mongoose.model('User', UserSchema); 