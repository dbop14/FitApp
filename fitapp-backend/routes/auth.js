const { redactEmail } = require('../utils/redact');
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// You should store these in environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
const { getJwtSecret } = require('../config/auth');
const JWT_SECRET = getJwtSecret();

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);


// 1. Start OAuth flow
router.get('/auth/google', (req, res) => {
  if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID' || !CLIENT_SECRET || CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
    console.error('❌ OAuth credentials not configured properly');
    console.error('CLIENT_ID:', CLIENT_ID ? CLIENT_ID.substring(0, 20) + '...' : 'MISSING');
    console.error('CLIENT_SECRET:', CLIENT_SECRET ? 'SET' : 'MISSING');
    return res.status(500).json({ error: 'OAuth not configured. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' });
  }
  
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'profile',
    'email'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // CRITICAL: Gets refresh token
    prompt: 'consent', // Force consent to get refresh token
    scope: scopes
  });
  console.log('🔐 Redirecting to Google OAuth consent screen');
  res.redirect(url);
});

// 2. Handle OAuth callback
router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  // Determine correct frontend URL based on request hostname, FRONTEND_URL, and GOOGLE_REDIRECT_URI
  // Priority: Request hostname (most reliable) > FRONTEND_URL > REDIRECT_URI > default
  let frontendUrl = FRONTEND_URL;
  
  const requestHost = req.get('host') || req.hostname || '';
  
  // First, check request hostname (most reliable - tells us which backend is handling the request)
  if (requestHost.includes('fitappdevbackend.herringm.com') || requestHost.includes('fitappbackenddev.herringm.com')) {
    frontendUrl = 'https://fitappdev.herringm.com';
  } else if (requestHost.includes('fitappbackend.herringm.com') && !requestHost.includes('fitappbackenddev')) {
    frontendUrl = 'https://fitapp.herringm.com';
  } else if (requestHost.includes('localhost:3001')) {
    frontendUrl = 'http://localhost:5174';
  } else if (requestHost.includes('localhost:3000')) {
    frontendUrl = 'http://localhost:5173';
  }
  // Fallback to FRONTEND_URL
  else if (FRONTEND_URL.includes('fitappdev.herringm.com')) {
    frontendUrl = 'https://fitappdev.herringm.com';
  } else if (FRONTEND_URL.includes('fitapp.herringm.com') && !FRONTEND_URL.includes('fitappdev')) {
    frontendUrl = 'https://fitapp.herringm.com';
  } else if (FRONTEND_URL.includes('localhost:5174')) {
    frontendUrl = 'http://localhost:5174';
  } else if (FRONTEND_URL.includes('localhost:5173')) {
    frontendUrl = 'http://localhost:5173';
  }
  // Final fallback to REDIRECT_URI
  else if (REDIRECT_URI.includes('fitappbackenddev.herringm.com')) {
    frontendUrl = 'https://fitappdev.herringm.com';
  } else if (REDIRECT_URI.includes('fitappbackend.herringm.com') && !REDIRECT_URI.includes('fitappbackenddev')) {
    frontendUrl = 'https://fitapp.herringm.com';
  } else if (REDIRECT_URI.includes('localhost:3001')) {
    frontendUrl = 'http://localhost:5174';
  } else if (REDIRECT_URI.includes('localhost:3000')) {
    frontendUrl = 'http://localhost:5173';
  }
  
  if (error) {
    console.error('❌ OAuth error from Google:', error);
    return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`);
  }
  
  if (!code) {
    console.error('❌ Missing authorization code');
    return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('missing_code')}`);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    console.log(`✅ Got user profile: ${redactEmail(profile.email)} (${profile.id})`);
    console.log(`🔑 Has refresh token: ${!!tokens.refresh_token}`);

    // Check if user already exists to preserve custom profile data
    const existingUser = await User.findOne({ googleId: profile.id });
    
    // Build update data - always update tokens and email
    const updateData = {
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, // This is the key for 30-day sync!
      tokenExpiry: tokens.expiry_date
    };
    
    // Preserve custom name and picture if they exist
    // Custom pictures are data URLs (start with "data:image")
    const isCustomPicture = existingUser?.picture && existingUser.picture.startsWith('data:image');
    
    // Only update name if user doesn't exist (new user)
    // This preserves any custom name the user has set
    if (!existingUser) {
      updateData.name = profile.name;
    } else {
      // Preserve existing name (may be custom)
      updateData.name = existingUser.name || profile.name;
      // Preserve existing dataSource preference (e.g., 'fitbit' if previously set)
      if (existingUser.dataSource) {
        updateData.dataSource = existingUser.dataSource;
      }
    }
    
    // Only update picture if:
    // 1. User doesn't exist (new user), OR
    // 2. User exists but has no picture, OR
    // 3. User's current picture is NOT a custom picture (data URL)
    if (!existingUser || !existingUser.picture || !isCustomPicture) {
      updateData.picture = profile.picture;
    } else {
      // Preserve the existing custom picture (data URL)
      updateData.picture = existingUser.picture;
    }

    // Upsert user in DB with tokens (preserving custom name/picture)
    const user = await User.findOneAndUpdate(
      { googleId: profile.id },
      { $set: updateData },
      { upsert: true, new: true }
    );

    console.log(`💾 User saved to database: ${redactEmail(user.email)}`);

    // Generate JWT token for frontend
    const jwtToken = jwt.sign(
      { 
        googleId: user.googleId, 
        email: user.email,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`🔑 Generated JWT token for frontend`);

    // Use the frontendUrl determined at the start of the callback handler
    const redirectUrl = `${frontendUrl}/auth/callback?token=${encodeURIComponent(jwtToken)}&googleId=${user.googleId}&email=${encodeURIComponent(user.email)}`;
    console.log(`🔄 Redirecting to frontend: ${frontendUrl}/auth/callback`);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('❌ OAuth callback error:', err);
    const errorMessage = err.message || 'OAuth failed';
    // Use the same frontendUrl detected earlier
    res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

// Fitbit OAuth Configuration
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const FITBIT_REDIRECT_URI = process.env.FITBIT_REDIRECT_URI || 'http://localhost:3000/api/auth/fitbit/callback';

// Helper function to determine frontend URL (same logic as Google OAuth)
function getFrontendUrl(req) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
  let frontendUrl = FRONTEND_URL;
  
  const requestHost = req.get('host') || req.hostname || '';
  
  if (requestHost.includes('fitappdevbackend.herringm.com') || requestHost.includes('fitappbackenddev.herringm.com')) {
    frontendUrl = 'https://fitappdev.herringm.com';
  } else if (requestHost.includes('fitappbackend.herringm.com') && !requestHost.includes('fitappbackenddev')) {
    frontendUrl = 'https://fitapp.herringm.com';
  } else if (requestHost.includes('localhost:3001')) {
    frontendUrl = 'http://localhost:5174';
  } else if (requestHost.includes('localhost:3000')) {
    frontendUrl = 'http://localhost:5173';
  } else if (FRONTEND_URL.includes('fitappdev.herringm.com')) {
    frontendUrl = 'https://fitappdev.herringm.com';
  } else if (FRONTEND_URL.includes('fitapp.herringm.com') && !FRONTEND_URL.includes('fitappdev')) {
    frontendUrl = 'https://fitapp.herringm.com';
  } else if (FRONTEND_URL.includes('localhost:5174')) {
    frontendUrl = 'http://localhost:5174';
  } else if (FRONTEND_URL.includes('localhost:5173')) {
    frontendUrl = 'http://localhost:5173';
  }
  
  return frontendUrl;
}

// 1. Start Fitbit OAuth flow
router.get('/auth/fitbit', (req, res) => {
  if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET) {
    console.error('❌ Fitbit OAuth credentials not configured');
    return res.status(500).json({ error: 'Fitbit OAuth not configured. Please check FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET environment variables.' });
  }
  
  // Get googleId from query parameter (user must be logged in with Google first)
  const { googleId } = req.query;
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId. User must be logged in with Google first.' });
  }
  
  // Required scopes for Fitbit
  // Best practice: Only request scopes that are needed
  // 'activity' - for steps and activity data
  // 'weight' - for weight data
  // 'profile' - for basic user profile information
  const scopes = ['activity', 'weight', 'profile'];
  const scopeString = scopes.join(' ');
  
  // Generate state parameter to include googleId for callback
  const state = Buffer.from(JSON.stringify({ googleId })).toString('base64');
  
  // Fitbit OAuth 2.0 authorization URL
  const authUrl = `https://www.fitbit.com/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${FITBIT_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(FITBIT_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopeString)}&` +
    `state=${encodeURIComponent(state)}`;
  
  console.log('🔐 Redirecting to Fitbit OAuth consent screen');
  res.redirect(authUrl);
});

// 2. Handle Fitbit OAuth callback
router.get('/auth/fitbit/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const state = req.query.state;
  
  const frontendUrl = getFrontendUrl(req);
  
  if (error) {
    console.error('❌ OAuth error from Fitbit:', error);
    return res.redirect(`${frontendUrl}/data-source-settings?error=${encodeURIComponent(error)}`);
  }
  
  if (!code) {
    console.error('❌ Missing authorization code');
    return res.redirect(`${frontendUrl}/data-source-settings?error=${encodeURIComponent('missing_code')}`);
  }
  
  if (!state) {
    console.error('❌ Missing state parameter');
    return res.redirect(`${frontendUrl}/data-source-settings?error=${encodeURIComponent('missing_state')}`);
  }
  
  try {
    // Decode state to get googleId
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { googleId } = stateData;
    
    if (!googleId) {
      throw new Error('Invalid state: missing googleId');
    }
    
    // Find user by googleId
    const user = await User.findOne({ googleId });
    if (!user) {
      throw new Error('User not found. Please log in with Google first.');
    }
    
    console.log('🔄 Exchanging Fitbit authorization code for tokens...');
    
    // Exchange authorization code for access token
    const credentials = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: FITBIT_CLIENT_ID,
        grant_type: 'authorization_code',
        redirect_uri: FITBIT_REDIRECT_URI,
        code: code
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Fitbit token exchange failed:', tokenResponse.status, errorText);
      throw new Error(`Fitbit token exchange failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    console.log(`✅ Got Fitbit tokens for user ${redactEmail(user.email)}`);
    console.log(`🔑 Has refresh token: ${!!tokenData.refresh_token}`);
    
    // Get Fitbit user ID from token response or fetch from profile
    let fitbitUserId = '-'; // Default to current user
    try {
      const profileResponse = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        fitbitUserId = profileData.user?.encodedId || '-';
      }
    } catch (profileError) {
      console.warn('⚠️ Could not fetch Fitbit user ID, using default:', profileError.message);
    }
    
    // Update user with Fitbit tokens
    const updateData = {
      fitbitAccessToken: tokenData.access_token,
      fitbitRefreshToken: tokenData.refresh_token,
      fitbitTokenExpiry: Date.now() + (tokenData.expires_in * 1000),
      fitbitUserId: fitbitUserId
    };
    
    await User.findOneAndUpdate(
      { googleId },
      { $set: updateData },
      { new: true }
    );
    
    console.log(`💾 Fitbit tokens saved for ${redactEmail(user.email)}`);
    
    // Redirect back to data source settings page
    res.redirect(`${frontendUrl}/data-source-settings?success=fitbit_connected`);
  } catch (err) {
    console.error('❌ Fitbit OAuth callback error:', err);
    const errorMessage = err.message || 'Fitbit OAuth failed';
    res.redirect(`${frontendUrl}/data-source-settings?error=${encodeURIComponent(errorMessage)}`);
  }
});


// ---------------------------------------------------------------------------
// Google Health API connection (behind GOOGLE_HEALTH_ENABLED)
// ---------------------------------------------------------------------------
const authenticateJWT = require('../middleware/auth');
const { isGoogleHealthEnabled, CONNECT_BACKFILL_DAYS } = require('../config/healthSources');
const googleHealthAuth = require('../utils/googleHealthAuth');

function frontendBase(req) {
  const host = req.get('host') || '';
  if (host.includes('fitappdevbackend.herringm.com') || host.includes('fitappbackenddev.herringm.com')) return 'https://fitappdev.herringm.com';
  if (host.includes('fitappbackend.herringm.com')) return 'https://fitapp.herringm.com';
  return process.env.FRONTEND_URL || 'http://localhost:5174';
}

// Step 1: the signed-in app asks for the consent URL (JWT required), then navigates to it.
router.get('/auth/google-health/url', authenticateJWT, (req, res) => {
  if (!isGoogleHealthEnabled()) return res.status(404).json({ error: 'Google Health is not enabled' });
  if (!req.user.googleId) return res.status(403).json({ error: 'Sign in first' });
  res.json({ url: googleHealthAuth.buildAuthUrl(req.user.googleId) });
});

// Step 2: Google redirects back here.
router.get('/auth/google-health/callback', async (req, res) => {
  const back = (params) => res.redirect(`${frontendBase(req)}/data-source-settings?${new URLSearchParams(params)}`);
  if (!isGoogleHealthEnabled()) return back({ googleHealth: 'error', reason: 'disabled' });
  const { code, state, error } = req.query;
  if (error) return back({ googleHealth: 'error', reason: String(error) });

  let googleId;
  try {
    googleId = googleHealthAuth.verifyState(String(state || ''));
  } catch {
    return back({ googleHealth: 'error', reason: 'expired' });
  }

  try {
    const user = await User.findOne({ googleId });
    if (!user) return back({ googleHealth: 'error', reason: 'no_user' });

    const tokens = await googleHealthAuth.exchangeCode(String(code || ''));
    const missing = require('../config/healthSources').GOOGLE_HEALTH_SCOPES.filter((sc) => !tokens.scope.includes(sc));
    if (missing.length) return back({ googleHealth: 'error', reason: 'scopes' });

    // Hold the new tokens on the document but do not switch over until a test read works.
    const previous = {
      oauthType: user.oauthType,
      dataSource: user.dataSource,
      googleHealthAccessToken: user.googleHealthAccessToken,
      googleHealthRefreshToken: user.googleHealthRefreshToken,
      googleHealthTokenExpiry: user.googleHealthTokenExpiry,
    };
    user.googleHealthAccessToken = tokens.accessToken;
    user.googleHealthRefreshToken = tokens.refreshToken || user.googleHealthRefreshToken;
    user.googleHealthTokenExpiry = tokens.expiry;

    const googleHealth = require('../services/health/googleHealth');
    const { todayYmd } = require('../services/health');
    try {
      const today = todayYmd();
      await googleHealth.getDailySteps(user, today, today);
    } catch (err) {
      // e.g. ACCOUNT_NOT_LINKED: a legacy Fitbit login that has not moved to Google.
      Object.assign(user, previous);
      await user.save().catch(() => {});
      console.error(`❌ Google Health test read failed for user ${googleId}: ${err.message}`);
      return back({ googleHealth: 'error', reason: err.code || `http_${err.status || 'unknown'}` });
    }

    // Cut over: one active health integration per user.
    const legacyFitbitToken = user.fitbitAccessToken;
    user.oauthType = 'google';
    user.dataSource = 'google-health';
    user.googleHealthConnectedAt = new Date();
    user.googleHealthLastError = undefined;
    user.fitbitAccessToken = undefined;
    user.fitbitRefreshToken = undefined;
    user.fitbitTokenExpiry = undefined;
    await user.save();
    console.log(`✅ User ${googleId} connected Google Health${legacyFitbitToken ? ' (legacy Fitbit tokens cleared)' : ''}`);

    // Backfill recent history in the background, then recount their v2 challenges.
    setImmediate(async () => {
      try {
        const { syncHealthHistory } = require('../services/health');
        const result = await syncHealthHistory(user, { days: CONNECT_BACKFILL_DAYS });
        console.log(`✅ Google Health backfill for ${googleId}: ${result?.rows.length || 0} day(s)`);
        const ChallengeParticipant = require('../models/ChallengeParticipant');
        const Challenge = require('../models/Challenge');
        const { recountV2Challenge } = require('../services/scoring/recountV2');
        const parts = await ChallengeParticipant.find({ userId: googleId }).select('challengeId').lean();
        for (const p of parts) {
          const c = await Challenge.findById(p.challengeId).catch(() => null);
          if (c && c.scoringMode === 'v2') await recountV2Challenge(c);
        }
      } catch (err) {
        console.error(`❌ Google Health backfill failed for ${googleId}: ${err.message}`);
      }
    });

    return back({ googleHealth: 'connected' });
  } catch (err) {
    console.error(`❌ Google Health connect failed for user ${googleId}: ${err.message}`);
    return back({ googleHealth: 'error', reason: err.code || 'exchange' });
  }
});

// Disconnect: revoke the Google Health token and go back to Google Fit.
router.post('/auth/google-health/disconnect', authenticateJWT, async (req, res) => {
  const user = await User.findOne({ googleId: req.user.googleId });
  if (!user) return res.status(404).json({ error: 'User not found' });
  await googleHealthAuth.revokeToken(user.googleHealthRefreshToken || user.googleHealthAccessToken);
  user.googleHealthAccessToken = undefined;
  user.googleHealthRefreshToken = undefined;
  user.googleHealthTokenExpiry = undefined;
  user.googleHealthLastError = undefined;
  if (user.dataSource === 'google-health') user.dataSource = 'google-fit';
  user.oauthType = undefined;
  await user.save();
  res.json({ dataSource: user.dataSource });
});

module.exports = router;
