/**
 * Helper function to ensure Fitbit OAuth tokens are valid and refresh proactively
 * Fitbit access tokens expire after 8 hours, refresh tokens last indefinitely
 * 
 * @param {Object} user - User document from MongoDB
 * @returns {Object} - { accessToken: string, refreshed: boolean }
 */
async function ensureValidFitbitTokens(user) {
  if (!user || !user.fitbitAccessToken) {
    throw new Error('User or Fitbit access token not found');
  }

  // Check if we have the required environment variables
  if (!process.env.FITBIT_CLIENT_ID || !process.env.FITBIT_CLIENT_SECRET) {
    throw new Error('Fitbit OAuth configuration missing');
  }

  // Check token validity
  const now = Date.now();
  const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
  const isExpired = !user.fitbitTokenExpiry || user.fitbitTokenExpiry < now;
  const expiresSoon = user.fitbitTokenExpiry && user.fitbitTokenExpiry < (now + oneHourInMs);
  const shouldRefresh = (isExpired || expiresSoon) && user.fitbitRefreshToken;

  // If token is expired and no refresh token, user needs to re-authenticate
  if (isExpired && !user.fitbitRefreshToken) {
    throw new Error('No Fitbit refresh token available. User needs to re-authenticate.');
  }

  // If token needs refresh and we have a refresh token, refresh it
  if (shouldRefresh) {
    try {
      const timeUntilExpiry = user.fitbitTokenExpiry ? Math.round((user.fitbitTokenExpiry - now) / (60 * 60 * 1000)) : 'unknown';
      console.log(`🔄 Proactively refreshing Fitbit token for user: ${user.email} (expires in ${timeUntilExpiry} hours)`);
      
      // Fitbit token refresh endpoint
      const credentials = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64');
      
      const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.fitbitRefreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Fitbit token refresh failed:', response.status, errorText);
        throw new Error(`Fitbit token refresh failed: ${response.status}`);
      }

      const tokenData = await response.json();
      
      // Update user with new tokens
      // Per Fitbit best practices: refresh tokens can only be used once
      // After using a refresh token, it becomes invalid and is replaced by the new one
      user.fitbitAccessToken = tokenData.access_token;
      user.fitbitTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
      
      // Fitbit always returns a new refresh token when refreshing
      // The old refresh token becomes invalid after use (best practice)
      if (tokenData.refresh_token) {
        user.fitbitRefreshToken = tokenData.refresh_token;
        console.log('✅ New refresh token received (old one is now invalid)');
      } else {
        // This shouldn't happen per Fitbit API, but handle gracefully
        console.warn('⚠️ No new refresh token in response - old token may still be valid');
      }
      await user.save();
      
      const newExpiryHours = tokenData.expires_in ? Math.round(tokenData.expires_in / 3600) : 'unknown';
      console.log(`✅ Fitbit token refreshed successfully. New token expires in ${newExpiryHours} hours`);
      
      return { accessToken: tokenData.access_token, refreshed: true };
    } catch (refreshError) {
      console.error('❌ Failed to refresh Fitbit token:', refreshError);
      if (refreshError.message.includes('invalid_grant') || refreshError.message.includes('401')) {
        throw new Error('Fitbit refresh token invalid. User needs to re-authenticate with Fitbit.');
      }
      throw new Error(`Failed to refresh Fitbit access token: ${refreshError.message}`);
    }
  }

  return { accessToken: user.fitbitAccessToken, refreshed: false };
}

module.exports = { ensureValidFitbitTokens };
