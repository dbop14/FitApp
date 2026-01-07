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
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// 1. Start OAuth flow
router.get('/auth/google', (req, res) => {
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
  
  if (error) {
    console.error('❌ OAuth error from Google:', error);
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error)}`);
  }
  
  if (!code) {
    console.error('❌ Missing authorization code');
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent('missing_code')}`);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    console.log(`✅ Got user profile: ${profile.email} (${profile.id})`);
    console.log(`🔑 Has refresh token: ${!!tokens.refresh_token}`);

    // Upsert user in DB with tokens (including refresh token!)
    const user = await User.findOneAndUpdate(
      { googleId: profile.id },
      {
        $set: {
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token, // This is the key for 30-day sync!
          tokenExpiry: tokens.expiry_date
        }
      },
      { upsert: true, new: true }
    );

    console.log(`💾 User saved to database: ${user.email}`);

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

    // Redirect to frontend callback with token and user info
    const redirectUrl = `${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(jwtToken)}&googleId=${user.googleId}&email=${encodeURIComponent(user.email)}`;
    console.log(`🔄 Redirecting to frontend: ${FRONTEND_URL}/auth/callback`);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('❌ OAuth callback error:', err);
    const errorMessage = err.message || 'OAuth failed';
    res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

module.exports = router; 