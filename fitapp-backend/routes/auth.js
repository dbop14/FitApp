const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User');

// You should store these in environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

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
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });
  res.redirect(url);
});

// 2. Handle OAuth callback
router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Upsert user in DB with tokens
    const user = await User.findOneAndUpdate(
      { googleId: profile.id },
      {
        $set: {
          name: profile.name,
          email: profile.email,
          // Optionally store tokens (encrypted!)
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date
        }
      },
      { upsert: true, new: true }
    );

    // Set a session/cookie or return a JWT (not shown here)
    // Redirect to frontend dashboard
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('OAuth failed');
  }
});

module.exports = router; 