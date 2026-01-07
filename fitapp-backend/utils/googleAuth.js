const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Helper function to ensure Google OAuth tokens are valid and refresh proactively
 * Refreshes tokens if they're expired or will expire within 1 day
 * This ensures tokens stay valid for 30 days after login
 * 
 * @param {Object} user - User document from MongoDB
 * @returns {Object} - { oauth2Client, refreshed: boolean }
 */
async function ensureValidGoogleTokens(user) {
  // #region agent log
  try{const logPath=path.join(__dirname,'../../.cursor/debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'googleAuth.js:11',message:'ensureValidGoogleTokens entry',data:{hasAccessToken:!!user?.accessToken,hasRefreshToken:!!user?.refreshToken,tokenExpiry:user?.tokenExpiry,email:user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
  // #endregion
  if (!user || !user.accessToken) {
    throw new Error('User or access token not found');
  }

  // Check if we have the required environment variables
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth configuration missing');
  }

  // Set up OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiry
  });

  // Proactive refresh: refresh if token is expired OR will expire within 1 day
  // This ensures tokens stay valid for 30 days after login
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  const shouldRefresh = !user.tokenExpiry || user.tokenExpiry < (now + oneDayInMs);
  // #region agent log
  try{const logPath=path.join(__dirname,'../../.cursor/debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'googleAuth.js:40',message:'Token refresh check',data:{now,tokenExpiry:user.tokenExpiry,shouldRefresh,hasRefreshToken:!!user.refreshToken,timeUntilExpiry:user.tokenExpiry?Math.round((user.tokenExpiry-now)/(60*60*1000)):'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){}
  // #endregion

  if (shouldRefresh) {
    if (!user.refreshToken) {
      // #region agent log
      try{const logPath=path.join(__dirname,'../../.cursor/debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'googleAuth.js:48',message:'No refresh token available',data:{tokenExpiry:user.tokenExpiry,now,isExpired:user.tokenExpiry?user.tokenExpiry<now:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
      // #endregion
      throw new Error('No refresh token available. User needs to re-authenticate.');
    }

    try {
      const timeUntilExpiry = user.tokenExpiry ? Math.round((user.tokenExpiry - now) / (60 * 60 * 1000)) : 'unknown';
      console.log(`🔄 Proactively refreshing token for user: ${user.email} (expires in ${timeUntilExpiry} hours)`);
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update user with new tokens, preserving the refresh token
      user.accessToken = credentials.access_token;
      user.tokenExpiry = credentials.expiry_date;
      // Important: Preserve the refresh token (it may not be in credentials if already set)
      if (credentials.refresh_token) {
        user.refreshToken = credentials.refresh_token;
      }
      await user.save();
      
      // Update OAuth2 client with new credentials
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: user.refreshToken, // Always use stored refresh token
        expiry_date: credentials.expiry_date
      });
      
      const newExpiryHours = credentials.expiry_date ? Math.round((credentials.expiry_date - Date.now()) / (60 * 60 * 1000)) : 'unknown';
      console.log(`✅ Token refreshed successfully. New token expires in ${newExpiryHours} hours`);
      
      return { oauth2Client, refreshed: true };
    } catch (refreshError) {
      console.error('❌ Failed to refresh token:', refreshError);
      if (refreshError.message.includes('No refresh token is set') || refreshError.message.includes('invalid_grant')) {
        throw new Error('Refresh token invalid. User needs to re-authenticate with Google.');
      }
      throw new Error(`Failed to refresh access token: ${refreshError.message}`);
    }
  }

  return { oauth2Client, refreshed: false };
}

module.exports = { ensureValidGoogleTokens };

