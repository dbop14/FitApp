const jwt = require('jsonwebtoken');

module.exports = function authenticateJWT(req, res, next) {
  // Allow OPTIONS requests (CORS preflight) to pass through
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  // Allow bot messages with bot secret header (for internal bot service)
  const botSecret = req.headers['x-bot-secret'];
  const expectedBotSecret = process.env.BOT_SECRET || process.env.BOT_PASSWORD;
  if (botSecret && expectedBotSecret && botSecret === expectedBotSecret) {
    console.log(`✅ Bot request authenticated via secret for ${req.method} ${req.path}`);
    req.user = { isBot: true }; // Set bot user
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
      if (err) {
        console.log(`❌ JWT verification failed for ${req.method} ${req.path}:`, err.message);
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    console.log(`❌ Missing authorization header for ${req.method} ${req.path}`);
    res.sendStatus(401);
  }
};
