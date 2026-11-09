// Use after authenticateJWT. The :googleId route param must be the caller's own.
module.exports = function requireSelf(req, res, next) {
  const googleId = req.user && req.user.googleId;
  if (googleId && googleId === req.params.googleId) {
    return next();
  }
  return res.status(403).json({ error: 'Not allowed for this user' });
};
