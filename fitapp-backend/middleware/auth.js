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
    // #region agent log
    const fs = require('fs');
    const logPath = process.platform === 'win32' ? '\\\\herring-nas\\docker\\fitapp\\.cursor\\debug.log' : '/Volumes/docker/fitapp/.cursor/debug.log';
    try {
      const logEntry = JSON.stringify({location:'middleware/auth.js:12',message:'Bot request authenticated via secret',data:{path:req.path,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'auth'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
    } catch(e) {}
    // #endregion
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
