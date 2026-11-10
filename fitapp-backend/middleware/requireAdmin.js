const { getAdminGoogleIds } = require('../config/auth');

// Use after authenticateJWT. Allows only Google IDs listed in ADMIN_GOOGLE_IDS.
// The bot's shared-secret identity is not an admin.
module.exports = function requireAdmin(req, res, next) {
  const googleId = req.user && req.user.googleId;
  if (googleId && getAdminGoogleIds().includes(googleId)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};
