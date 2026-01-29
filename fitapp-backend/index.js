// Set timezone to New York to ensure consistent date boundaries
process.env.TZ = 'America/New_York';

const express = require('express')
const app = express()
// Backend port: 3000 for production, configurable via PORT env var
// Development maps host port 3001 to container port 3000
// Production maps host port 3000 to container port 3000
const PORT = process.env.PORT || 3000
const cors = require('cors')
const { google } = require('googleapis')
const cron = require('node-cron')

// CORS allowed origins - includes both production and development domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://fitapp.herringm.com',
  'https://fitappbackend.herringm.com',
  'https://fitappdev.herringm.com',
  'https://fitappbackenddev.herringm.com'
];

// Handle preflight OPTIONS requests for CORS
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure CORS to allow your frontend domain
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

const Challenge = require('./models/Challenge');
const User = require('./models/User');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const FitnessHistory = require('./models/FitnessHistory');

const mongoose = require('mongoose');
const leaderboardRoutes = require('./routes/leaderboard');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenge');
const chatRoutes = require('./routes/chat');
const realtimeRoutes = require('./routes/realtime');
const { broadcastUserUpdate } = require('./routes/realtime');
const { router: pushRoutes, sendPushNotification } = require('./routes/push');
const jwt = require('jsonwebtoken');

const authenticateJWT = require('./middleware/auth');

const DEFAULT_STEP_GOAL = 10000;
const RECALC_LOOKBACK_DAYS = 7;

// Application timezone (IANA name, e.g. America/New_York).
// Used for cron jobs and day-based calculations on the backend.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York';

// Get the offset in milliseconds between UTC and a given timezone at a specific date
const getTimezoneOffsetMs = (date, timeZone) => {
  const localized = new Date(date.toLocaleString('en-US', { timeZone }));
  return localized.getTime() - date.getTime();
};

// Helper function for weight loss points rounding
// .5 or higher rounds up, .4 or lower rounds down
// Ensures points are never negative (minimum 0)
function roundWeightLossPoints(percentage) {
  // Ensure percentage is never negative (safety check)
  const safePercentage = Math.max(0, percentage);
  const decimal = safePercentage % 1;
  if (decimal >= 0.5) {
    return Math.ceil(safePercentage);
  } else {
    return Math.floor(safePercentage);
  }
}

const getStepGoal = (challenge) => {
  const stepGoalValue = challenge?.stepGoal || DEFAULT_STEP_GOAL;
  const stepGoalNum = typeof stepGoalValue === 'string' ? parseInt(stepGoalValue, 10) : Number(stepGoalValue);
  return Number.isFinite(stepGoalNum) && stepGoalNum > 0 ? stepGoalNum : DEFAULT_STEP_GOAL;
};

const getDayKey = (date, timeZone = APP_TIMEZONE) => {
  const zoned = new Date(date.toLocaleString('en-US', { timeZone }));
  zoned.setHours(0, 0, 0, 0);
  return zoned.getTime();
};

// Helper function to check if a new calendar day has started since the last point was earned.
// This allows earning one point per day based on calendar date, not a 24-hour window.
function has24HoursPassed(timestamp) {
  if (!timestamp) return true; // No previous point, so eligible
  const todayKey = getDayKey(new Date());
  const lastKey = getDayKey(new Date(timestamp));
  return todayKey > lastKey;
}

const shouldRecalculateChallenge = (challenge, today) => {
  if (!challenge?.startDate || !challenge?.endDate) return false;
  const startDate = FitnessHistory.normalizeDate(new Date(challenge.startDate));
  const endDate = FitnessHistory.normalizeDate(new Date(challenge.endDate));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - RECALC_LOOKBACK_DAYS);
  return today >= startDate && endDate >= cutoff;
};

const recalculateStepPoints = async () => {
  try {
    console.log('🔁 Starting step point recalculation job...');
    const today = FitnessHistory.normalizeDate(new Date());
    const challenges = await Challenge.find({});
    let challengesProcessed = 0;
    let participantsUpdated = 0;

    for (const challenge of challenges) {
      if (!shouldRecalculateChallenge(challenge, today)) {
        continue;
      }

      const challengeId = challenge._id.toString();
      const stepGoalValue = challenge.stepGoal || DEFAULT_STEP_GOAL;
      const stepGoal = typeof stepGoalValue === 'string' ? parseInt(stepGoalValue, 10) : Number(stepGoalValue);
      const normalizedGoal = Number.isFinite(stepGoal) && stepGoal > 0 ? stepGoal : DEFAULT_STEP_GOAL;
      const startDate = FitnessHistory.normalizeDate(new Date(challenge.startDate));
      const endDate = FitnessHistory.normalizeDate(new Date(challenge.endDate));

      const participants = await ChallengeParticipant.find({ challengeId });
      challengesProcessed++;
      console.log(`🔍 Recalculating step points for challenge ${challenge.name} (${participants.length} participants)`);

      for (const participant of participants) {
        const history = await FitnessHistory.find({
          userId: participant.userId,
          date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        let daysAchieved = 0;
        let latestAchievedDate = null;
        const latestHistory = history.length > 0 ? history[history.length - 1] : null;

        for (const entry of history) {
          if ((entry.steps || 0) >= normalizedGoal) {
            daysAchieved += 1;
            latestAchievedDate = entry.date;
          }
        }

        const updates = {};
        if (participant.stepGoalPoints !== daysAchieved) {
          updates.stepGoalPoints = daysAchieved;
        }
        if (participant.stepGoalDaysAchieved !== daysAchieved) {
          updates.stepGoalDaysAchieved = daysAchieved;
        }

        const normalizedLatestAchieved = latestAchievedDate ? FitnessHistory.normalizeDate(new Date(latestAchievedDate)) : null;
        const currentLastStepDate = participant.lastStepDate ? FitnessHistory.normalizeDate(new Date(participant.lastStepDate)) : null;
        if (normalizedLatestAchieved && (!currentLastStepDate || normalizedLatestAchieved.getTime() !== currentLastStepDate.getTime())) {
          updates.lastStepDate = normalizedLatestAchieved;
          updates.lastStepPointTimestamp = normalizedLatestAchieved;
        } else if (!normalizedLatestAchieved && currentLastStepDate) {
          updates.lastStepDate = null;
          updates.lastStepPointTimestamp = null;
        }

        if (latestHistory && participant.lastStepCount !== latestHistory.steps) {
          updates.lastStepCount = latestHistory.steps;
        }

        const weightLossPoints = participant.weightLossPoints || 0;
        const totalPoints = daysAchieved + weightLossPoints;
        if (participant.points !== totalPoints) {
          updates.points = totalPoints;
        }

        if (Object.keys(updates).length > 0) {
          participant.set(updates);
          await participant.save();
          participantsUpdated++;
        }
      }
    }

    console.log(`✅ Step point recalculation complete. Challenges processed: ${challengesProcessed}, participants updated: ${participantsUpdated}`);
  } catch (error) {
    console.error('❌ Error during step point recalculation:', error);
  }
};

// Helper function to check if challenge has ended
function isChallengeEnded(challenge) {
  if (!challenge.endDate) return false;
  const endDate = new Date(challenge.endDate);
  const now = new Date();
  return now >= endDate;
}

// Import Google Auth utility
const { ensureValidGoogleTokens } = require('./utils/googleAuth');
const backfillStepHistoryAndPoints = require('./scripts/backfillStepHistoryAndPoints');

// Connect to MongoDB
// Add replicaSet parameter if not already present (for replica set mode)
let mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
if (!mongoUri.includes('replicaSet=') && !mongoUri.includes('?')) {
  mongoUri += '?replicaSet=rs0';
} else if (!mongoUri.includes('replicaSet=') && mongoUri.includes('?')) {
  mongoUri += '&replicaSet=rs0';
}
console.log(`🔌 Connecting to MongoDB at ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000
}).catch(err => {
  console.error('❌ MongoDB connection error on initial connect:', err.message);
});

// MongoDB connection event handlers
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Scheduled job to reset all users' steps to 0 at midnight every day
// Runs at 00:00:00 (midnight) in the server's timezone
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('🔄 Starting daily step reset at midnight...');
    
    // Reset all users' steps to 0
    const result = await User.updateMany(
      {},
      { $set: { steps: 0 } }
    );
    
    console.log(`✅ Daily step reset completed: ${result.modifiedCount} users' steps reset to 0`);
    
    // Broadcast update to all connected clients via SSE
    // Note: This will notify all users that their steps have been reset
    // The frontend should handle this gracefully by showing 0 steps
    const allUsers = await User.find({});
    for (const user of allUsers) {
      broadcastUserUpdate(user.googleId, {
        steps: 0,
        weight: user.weight,
        lastSync: user.lastSync
      });
    }
    
    console.log(`📡 Broadcasted step reset updates to ${allUsers.length} users`);
  } catch (error) {
    console.error('❌ Error during daily step reset:', error);
  }
}, {
  timezone: APP_TIMEZONE
});

console.log('⏰ Daily step reset cron job scheduled (runs at midnight)');

// Recalculate step points hourly to keep totals consistent with history
cron.schedule('5 * * * *', async () => {
  await recalculateStepPoints();
}, {
  timezone: APP_TIMEZONE
});

console.log('⏰ Hourly step point recalculation scheduled (runs at :05)');

// Nightly job to pull today's step data for users in active challenges
// and ensure their step points are in sync before midnight reset.
// Runs at 23:55 in the configured APP_TIMEZONE.
cron.schedule('55 23 * * *', async () => {
  try {
    console.log('⏰ Starting nightly active-challenge step history backfill at 23:55...');
    await backfillStepHistoryAndPoints();
    console.log('✅ Nightly active-challenge step history backfill completed');
  } catch (error) {
    console.error('❌ Error during nightly step history backfill:', error);
  }
}, {
  timezone: APP_TIMEZONE
});

console.log('⏰ Nightly active-challenge step backfill scheduled (runs at 23:55)');

// Increase JSON body size limit to 1MB to accommodate profile photos
// Profile photos are compressed to ~50KB file size (~67KB as base64 data URL)
// But we allow up to 1MB for flexibility
app.use(express.json({ limit: '1mb' }))

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cors: 'configured'
  });
});

// Test endpoint to check environment variables
app.get('/api/test-env', (req, res) => {
  res.json({
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGoogleRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
    googleClientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set'
  });
});

// Test endpoint to check Google Fit API access
app.get('/api/test-google-fit/:googleId', async (req, res) => {
  const { googleId } = req.params;
  
  try {
    const user = await User.findOne({ googleId });
    if (!user || !user.accessToken) {
      return res.status(404).json({ error: 'User or tokens not found' });
    }

    // Test basic Google Fit API access
    const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ 
        error: 'Google Fit API test failed', 
        status: response.status,
        details: errorText 
      });
    }

    const data = await response.json();
    res.json({ 
      success: true, 
      dataSourceCount: data.dataSource?.length || 0,
      dataSources: data.dataSource?.map(ds => ({
        type: ds.dataType.name,
        streamId: ds.streamId
      })) || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Test failed', details: err.message });
  }
});

// JWT token generation endpoint - must be defined before route mounting
app.post('/api/auth/token', async (req, res) => {
  const { googleId, name, email, picture } = req.body;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId' });
  }

  try {
    // Find or create user
    let user = await User.findOne({ googleId });
    
    if (!user) {
      // Create new user if they don't exist
      user = new User({
        googleId,
        name: name || 'Unknown User',
        email: email || '',
        picture: picture || '',
        steps: 0,
        weight: null,
        lastSync: new Date()
      });
      await user.save();
      console.log(`✅ Created new user: ${email || googleId}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        googleId: user.googleId, 
        email: user.email,
        name: user.name 
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    console.log(`🔑 Generated JWT token for user: ${user.email || googleId}`);
    
    res.json({ 
      token,
      user: {
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        steps: user.steps,
        weight: user.weight,
        lastSync: user.lastSync
      }
    });
  } catch (err) {
    console.error('❌ Token generation failed:', err);
    res.status(500).json({ error: 'Failed to generate token', details: err.message });
  }
});

// NOTE: Challenge creation is now handled by /api/challenge route in routes/challenge.js
// This route includes Matrix room creation. The old route below has been removed to avoid conflicts.
// If you need to create challenges, use POST /api/challenge which is handled by challengeRoutes

// GET: Return challenge by MongoDB _id
app.get('/api/challenge/:id', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challenge', details: err.message });
  }
});

// GET: Return challenge by challenge code
app.get('/api/challenge/code/:code', async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ challengeCode: req.params.code });
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challenge', details: err.message });
  }
});

// Leaderboard routes
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/chat', authenticateJWT, chatRoutes)
app.use('/api/push', authenticateJWT, pushRoutes)

// Endpoint to refresh Google Fit access token using backend's refresh token
// This allows frontend to get a new access token without prompting user to login
// If backend has no refresh token, it will return the current access token if still valid
app.get('/api/auth/refresh-google-fit-token/:googleId', async (req, res) => {
  const { googleId } = req.params;
  if (!googleId) return res.status(400).json({ error: 'Missing googleId' });
  
  try {
    console.log(`🔄 Refresh token request for googleId: ${googleId}`);
    const user = await User.findOne({ googleId });
    if (!user) {
      console.log(`❌ User not found: ${googleId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`📊 User found: ${user.email}, hasAccessToken: ${!!user.accessToken}, hasRefreshToken: ${!!user.refreshToken}, tokenExpiry: ${user.tokenExpiry ? new Date(user.tokenExpiry).toISOString() : 'null'}`);
    
    if (!user.accessToken) {
      console.log(`⚠️ User ${user.email} has no access token in database`);
      return res.status(401).json({ 
        error: 'No access token available',
        message: 'User needs to authenticate with Google Fit first',
        needsReauth: true
      });
    }
    
    // Check if user has refresh token - if yes, use it to refresh
    // If no refresh token, check if current token is still valid (with 5 minute buffer for network delays)
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer (instead of 1 hour) since GIS tokens expire after 1 hour
    const tokenStillValid = user.tokenExpiry && user.tokenExpiry > (now + bufferTime);
    
    if (user.refreshToken) {
      // User has refresh token - use ensureValidGoogleTokens to refresh if needed
      try {
        const { ensureValidGoogleTokens } = require('./utils/googleAuth');
        const tokenResult = await ensureValidGoogleTokens(user);
        
        // Reload user from database to get updated token (user.save() was called in ensureValidGoogleTokens)
        const updatedUser = await User.findOne({ googleId });
        
        return res.json({
          accessToken: updatedUser.accessToken,
          expiryTime: updatedUser.tokenExpiry,
          refreshed: tokenResult.refreshed
        });
      } catch (refreshError) {
        console.error('❌ Failed to refresh token with refresh token:', refreshError);
        // If refresh fails, check if current token is still valid
        if (tokenStillValid) {
          console.log('⚠️ Refresh failed but current token still valid, returning it');
          return res.json({
            accessToken: user.accessToken,
            expiryTime: user.tokenExpiry,
            refreshed: false
          });
        }
        // Refresh failed and token expired - need reauth
        if (refreshError.message.includes('re-authenticate') || refreshError.message.includes('Refresh token invalid')) {
          return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please re-authenticate with Google to continue syncing data',
            needsReauth: true
          });
        }
        throw refreshError;
      }
    } else {
      // No refresh token - check if current token is still valid
      if (tokenStillValid) {
        console.log('✅ No refresh token but current token still valid, returning it');
        return res.json({
          accessToken: user.accessToken,
          expiryTime: user.tokenExpiry,
          refreshed: false
        });
      } else {
        // No refresh token and token expired - need reauth
        const hoursExpired = user.tokenExpiry ? (Date.now() - user.tokenExpiry) / (1000 * 60 * 60) : 'unknown';
        console.log(`⚠️ No refresh token and token expired (${hoursExpired.toFixed(1)} hours ago), user ${user.email} needs to re-authenticate`);
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please re-authenticate with Google to continue syncing data',
          needsReauth: true
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to refresh Google Fit token:', error);
    return res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

// Google Fit sync endpoint (no JWT required - uses stored Google tokens)
app.get('/api/sync-google-fit/:googleId', async (req, res) => {
  const { googleId } = req.params;
  if (!googleId) return res.status(400).json({ error: 'Missing googleId' });
  
  try {
    console.log(`🔄 Starting Google Fit sync for user: ${googleId}`);
    
    const user = await User.findOne({ googleId });
    if (!user) {
      console.log(`❌ User not found for: ${googleId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If user exists but has no accessToken, return stored weight instead of syncing
    if (!user.accessToken) {
      console.log(`⚠️ No access token for user: ${googleId}, returning stored weight`);
      return res.json({ 
        weight: user.weight || null, 
        steps: user.steps || 0,
        lastSync: user.lastSync || null,
        synced: false,
        message: 'No Google Fit access token available. Using stored weight.'
      });
    }

    console.log(`✅ Found user: ${user.email} with access token`);

    // Ensure tokens are valid and refresh proactively if needed
    let oauth2Client;
    try {
      const tokenResult = await ensureValidGoogleTokens(user);
      oauth2Client = tokenResult.oauth2Client;
      console.log(`🔑 OAuth2 client configured for user: ${user.email}${tokenResult.refreshed ? ' (token refreshed proactively)' : ''}`);
    } catch (tokenError) {
      console.error('❌ Token validation/refresh failed:', tokenError);
      if (tokenError.message.includes('re-authenticate') || tokenError.message.includes('Refresh token invalid')) {
        return res.status(401).json({ 
          error: 'Authentication required', 
          message: 'Please re-authenticate with Google to continue syncing data',
          needsReauth: true
        });
      }
      return res.status(500).json({ error: tokenError.message || 'Failed to validate/refresh tokens' });
    }

    // Fetch Google Fit data - timezone-aware approach using configured APP_TIMEZONE
    const now = new Date();
    
    // Get user's local time based on the configured application timezone
    const userTimezoneOffset = getTimezoneOffsetMs(now, APP_TIMEZONE);
    const userLocalTime = new Date(now.getTime() + userTimezoneOffset);
    
    // Get today's start time (12:01 AM) and current time in user's timezone
    const startOfToday = new Date(userLocalTime.getFullYear(), userLocalTime.getMonth(), userLocalTime.getDate(), 0, 1, 0, 0);
    const currentTime = new Date(userLocalTime.getTime());
    const endOfToday = new Date(userLocalTime.getFullYear(), userLocalTime.getMonth(), userLocalTime.getDate(), 23, 59, 59, 999);
    
    console.log(`📊 Current UTC time: ${now.toISOString()}`);
    console.log(`📊 Current user local time (${APP_TIMEZONE}): ${userLocalTime.toISOString()}`);
    // Enhanced timezone debugging
    console.log(`📊 === TIMEZONE DEBUGGING ===`);
    console.log(`📊 Current UTC time: ${now.toISOString()}`);
    console.log(`📊 User timezone offset (from APP_TIMEZONE=${APP_TIMEZONE}): ${userTimezoneOffset}ms (${userTimezoneOffset / (60 * 60 * 1000)} hours)`);
    console.log(`📊 Current user local time (${APP_TIMEZONE}): ${userLocalTime.toISOString()}`);
    console.log(`📊 User local time string: ${userLocalTime.toString()}`);
    console.log(`📊 Fetching Google Fit data from ${startOfToday.toISOString()} to ${currentTime.toISOString()}`);
    console.log(`📊 This covers today only: from 12:01 AM to current time`);
    console.log(`📊 Today's date in configured timezone (${APP_TIMEZONE}): ${userLocalTime.toDateString()}`);
    console.log(`📊 Start of today: ${startOfToday.toDateString()} ${startOfToday.toTimeString()}`);
    console.log(`📊 Current time: ${currentTime.toDateString()} ${currentTime.toTimeString()}`);
    console.log(`📊 Time range in milliseconds: ${startOfToday.getTime()} to ${currentTime.getTime()}`);
    console.log(`📊 === END TIMEZONE DEBUGGING ===`);
    
    let steps = 0;
    let weight = null;
    
    // Get step count using the aggregate API - this is more reliable
    try {
      console.log(`🔄 Fetching step count using aggregate API...`);
      console.log(`📊 Time range: ${startOfToday.toISOString()} to ${currentTime.toISOString()}`);
      console.log(`📊 Time in milliseconds: ${startOfToday.getTime()} to ${currentTime.getTime()}`);
      
      // Request data for today only (from 12:01 AM to current time)
      
      // Note: We only request 'delta' in aggregateBy, but we'll check for 'summary' in the response
      // 'summary' is not a valid aggregate data type, but may appear in responses from synced devices
      const requestBody = {
        aggregateBy: [
          { 
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // Daily buckets for estimated steps
        startTimeMillis: startOfToday.getTime(),
        endTimeMillis: currentTime.getTime()
      };
      
      console.log(`📊 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const aggregateResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log(`📊 Aggregate API response status: ${aggregateResponse.status}`);
      
      if (aggregateResponse.ok) {
        const aggregateData = await aggregateResponse.json();
        console.log(`📊 Aggregate API response:`, JSON.stringify(aggregateData, null, 2));
        
                 if (!aggregateData.bucket || aggregateData.bucket.length === 0) {
           console.log(`📊 No buckets found in aggregate response`);
         } else {
           console.log(`📊 Found ${aggregateData.bucket.length} buckets`);
           
           // Collect all step data points from all buckets with timestamps
           const allStepData = [];
           
           for (let i = 0; i < aggregateData.bucket.length; i++) {
             const bucket = aggregateData.bucket[i];
             console.log(`📊 Checking bucket ${i}:`, JSON.stringify(bucket, null, 2));
             
             if (!bucket.dataset || bucket.dataset.length === 0) {
               console.log(`📊 No datasets found in bucket ${i}`);
               continue;
             }
             
             console.log(`📊 Found ${bucket.dataset.length} datasets in bucket ${i}`);
             
             // Look for any dataset that contains step data (including Fitbit-synced summary data)
             const stepsData = bucket.dataset.find(d => 
               d.dataTypeName === 'com.google.step_count.delta' || 
               d.dataTypeName === 'com.google.step_count.cumulative' ||
               d.dataTypeName === 'com.google.step_count.summary' || // Include summary for Fitbit-synced data
               d.dataSourceId?.includes('step_count.delta') ||
               d.dataSourceId?.includes('step_count.cumulative') ||
               d.dataSourceId?.includes('step_count.summary') || // Include summary for Fitbit-synced data
               d.dataSourceId?.includes('fitbit') // Include Fitbit data sources
             );
             
             if (stepsData && stepsData.point && stepsData.point.length > 0) {
               console.log(`📊 Steps dataset found in bucket ${i}:`, JSON.stringify(stepsData, null, 2));
               
               // Sum up all delta points for this bucket to get total steps for the day
               let totalStepsForDay = 0;
               for (const point of stepsData.point) {
                 if (point.value && point.value.length > 0) {
                   const stepValue = point.value[0];
                   if (stepValue.intVal !== undefined && stepValue.intVal > 0) {
                     totalStepsForDay += stepValue.intVal;
                     console.log(`📊 Adding ${stepValue.intVal} steps from point: ${new Date(parseInt(point.startTimeNanos) / 1000000).toISOString()}`);
                   }
                 }
               }
               
                                if (totalStepsForDay > 0) {
                   const bucketStartDate = new Date(parseInt(bucket.startTimeMillis));
                   const bucketEndDate = new Date(parseInt(bucket.endTimeMillis));
                   
                   // Validate dates before using them
                   if (isNaN(bucketStartDate.getTime()) || isNaN(bucketEndDate.getTime())) {
                     console.log(`📊 Invalid date in bucket ${i}, skipping: startTimeMillis=${bucket.startTimeMillis}, endTimeMillis=${bucket.endTimeMillis}`);
                     continue;
                   }
                   
                   allStepData.push({
                     steps: totalStepsForDay,
                     timestamp: parseInt(stepsData.point[0].startTimeNanos) / 1000000, // Convert to milliseconds
                     bucketStart: bucketStartDate,
                     bucketEnd: bucketEndDate,
                     dataSource: stepsData.point[0].originDataSourceId || 'unknown'
                   });
                   console.log(`📊 Added total step data: ${totalStepsForDay} steps from ${bucketStartDate.toDateString()} (${bucketStartDate.toISOString()}) to ${bucketEndDate.toDateString()} (${bucketEndDate.toISOString()}) (${stepsData.point[0].originDataSourceId})`);
                 }
             }
           }
           
           // Sort by timestamp to get the most recent data
           allStepData.sort((a, b) => b.timestamp - a.timestamp);
           console.log(`📊 All step data sorted by timestamp:`, allStepData);
           
           if (allStepData.length > 0) {
             try {
               // Get today's date in user's timezone
               const today = new Date(userLocalTime.getFullYear(), userLocalTime.getMonth(), userLocalTime.getDate());
               
               console.log(`📊 Looking for data from today: ${today.toDateString()}`);
               console.log(`📊 All available step data:`, allStepData.map(data => ({
                 steps: data.steps,
                 date: data.bucketStart.toDateString(),
                 timestamp: data.timestamp,
                 dataSource: data.dataSource
               })));
               
                            // Filter data for today only - be more precise with date comparison
             const todayData = allStepData.filter(data => {
               try {
                 const dataDate = new Date(data.bucketStart.getFullYear(), data.bucketStart.getMonth(), data.bucketStart.getDate());
                 const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                 const isToday = dataDate.getTime() === todayDate.getTime();
                 
                 console.log(`📊 Comparing: ${dataDate.toDateString()} vs ${todayDate.toDateString()} = ${isToday} (bucket: ${data.steps} steps)`);
                 return isToday;
               } catch (dateError) {
                 console.log(`📊 Error comparing dates for data:`, dateError.message);
                 return false;
               }
             });
             
             console.log(`📊 Today's step data buckets:`, todayData.map(data => ({
               steps: data.steps,
               date: data.bucketStart.toDateString(),
               dataSource: data.dataSource
             })));
             
                          if (todayData.length > 0) {
               // Sum up all steps for today
               const totalTodaySteps = todayData.reduce((total, data) => total + data.steps, 0);
               console.log(`📊 Total steps for today: ${totalTodaySteps} (sum of ${todayData.length} buckets)`);
               
               // If the total seems too low compared to expected, try different bucket sizes
               if (totalTodaySteps < 4500) {
                 console.log(`📊 Warning: Today's step total (${totalTodaySteps}) seems low. Expected around 5,082 steps but only found ${totalTodaySteps} steps.`);
                 console.log(`📊 Missing approximately ${5082 - totalTodaySteps} steps.`);
               }
               
               steps = totalTodaySteps;
             } else {
               // Fall back to most recent data if no today data found
               const mostRecent = allStepData[0];
               steps = mostRecent.steps;
               console.log(`📊 No today data found, using most recent step data: ${steps} from ${mostRecent.bucketStart.toDateString()} (${mostRecent.dataSource})`);
             }
             } catch (stepProcessingError) {
               console.log(`📊 Error processing step data:`, stepProcessingError.message);
               // Fall back to most recent data if processing fails
               if (allStepData.length > 0) {
                 const mostRecent = allStepData[0];
                 steps = mostRecent.steps;
                 console.log(`📊 Using fallback step data: ${steps} from ${mostRecent.bucketStart.toDateString()} (${mostRecent.dataSource})`);
               }
             }
             } else {
               console.log(`📊 No valid step data found in any bucket`);
             }
         }
      } else {
        const errorText = await aggregateResponse.text();
        console.log(`📊 Estimated steps API error: HTTP ${aggregateResponse.status} - ${errorText}`);
        
        // Fallback to regular aggregated data source
        console.log(`📊 Trying fallback with regular aggregated data source...`);
        try {
          const fallbackRequestBody = {
            aggregateBy: [
              { dataTypeName: 'com.google.step_count.delta' }
            ],
            bucketByTime: { durationMillis: 60 * 60 * 1000 }, // Hourly buckets for granular data
            startTimeMillis: startOfToday.getTime(),
            endTimeMillis: currentTime.getTime()
          };
          
          const fallbackResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user.accessToken}`,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify(fallbackRequestBody),
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`📊 Fallback API response:`, JSON.stringify(fallbackData, null, 2));
            
            // Process fallback data the same way as before
            if (fallbackData.bucket && fallbackData.bucket.length > 0) {
              // ... existing processing logic for buckets
              console.log(`📊 Using fallback data with ${fallbackData.bucket.length} buckets`);
            }
          } else {
            console.log(`📊 Fallback API also failed: HTTP ${fallbackResponse.status}`);
          }
        } catch (fallbackError) {
          console.log(`📊 Fallback error:`, fallbackError);
        }
      }
      
      // If we didn't get enough steps, try with daily buckets as fallback
      if (steps < 4500) {
        console.log(`📊 Trying fallback with daily buckets to get complete step data...`);
        
        // Also try different timezone offsets around the configured APP_TIMEZONE
        // to see if that affects the data returned by Google Fit.
        console.log(`📊 Trying different timezone offsets (relative to APP_TIMEZONE=${APP_TIMEZONE}) to find missing steps...`);
        const baseOffset = userTimezoneOffset;
        const oneHour = 60 * 60 * 1000;
        const timezoneOffsets = [
          baseOffset,               // configured timezone
          baseOffset - oneHour,     // 1 hour earlier
          baseOffset + oneHour,     // 1 hour later
          baseOffset - 2 * oneHour, // 2 hours earlier
          baseOffset + 2 * oneHour, // 2 hours later
          0                         // UTC
        ];
        
        for (const offset of timezoneOffsets) {
          try {
            const testLocalTime = new Date(now.getTime() + offset);
            const testStartOfToday = new Date(testLocalTime.getFullYear(), testLocalTime.getMonth(), testLocalTime.getDate(), 0, 1, 0, 0);
            const testCurrentTime = new Date(testLocalTime.getTime());
            
            console.log(`📊 Testing timezone offset ${offset / (60 * 60 * 1000)} hours: ${testStartOfToday.toISOString()} to ${testCurrentTime.toISOString()}`);
            
            const testRequestBody = {
              aggregateBy: [
                { dataTypeName: 'com.google.step_count.delta' }
              ],
              bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
              startTimeMillis: testStartOfToday.getTime(),
              endTimeMillis: testCurrentTime.getTime()
            };
            
            const testResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${user.accessToken}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              body: JSON.stringify(testRequestBody),
            });
            
            if (testResponse.ok) {
              const testData = await testResponse.json();
              if (testData.bucket && testData.bucket.length > 0) {
                const testStepsData = testData.bucket[0].dataset?.find(d => 
                  d.dataTypeName === 'com.google.step_count.delta' || 
                  d.dataSourceId?.includes('step_count.delta')
                );
                
                if (testStepsData?.point?.[0]?.value?.[0]?.intVal) {
                  const testSteps = testStepsData.point[0].value[0].intVal;
                  console.log(`📊 Timezone offset ${offset / (60 * 60 * 1000)} hours found ${testSteps} steps`);
                  
                  if (testSteps > steps) {
                    console.log(`📊 Found better step count with timezone offset ${offset / (60 * 60 * 1000)} hours: ${testSteps} steps`);
                    steps = testSteps;
                  }
                }
              }
            }
          } catch (timezoneError) {
            console.log(`📊 Error testing timezone offset ${offset / (60 * 60 * 1000)} hours:`, timezoneError.message);
          }
        }
        try {
          const dailyRequestBody = {
            aggregateBy: [
              { dataTypeName: 'com.google.step_count.delta' }
            ],
            bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // Daily buckets
            startTimeMillis: startOfToday.getTime(),
            endTimeMillis: currentTime.getTime()
          };
          
          const dailyResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user.accessToken}`,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify(dailyRequestBody),
          });
          
          if (dailyResponse.ok) {
            const dailyData = await dailyResponse.json();
            console.log(`📊 Daily bucket fallback response:`, JSON.stringify(dailyData, null, 2));
            
            if (dailyData.bucket && dailyData.bucket.length > 0) {
              const dailyStepsData = dailyData.bucket[0].dataset?.find(d => 
                d.dataTypeName === 'com.google.step_count.delta' || 
                d.dataSourceId?.includes('step_count.delta')
              );
              
              if (dailyStepsData?.point?.[0]?.value?.[0]?.intVal) {
                const dailySteps = dailyStepsData.point[0].value[0].intVal;
                console.log(`📊 Daily bucket fallback found ${dailySteps} steps`);
                
                if (dailySteps > steps) {
                  steps = dailySteps;
                  console.log(`📊 Using daily bucket fallback: ${steps} steps`);
                }
              }
            }
          }
        } catch (fallbackError) {
          console.log(`📊 Daily bucket fallback error:`, fallbackError.message);
        }
      }
      
      // Try fetching from specific data sources we know exist
      if (steps < 5000) {
        console.log(`📊 Trying specific data source fetching to get missing steps...`);
        try {
          // Use the data source IDs we saw in the aggregate response
          const knownDataSources = [
            'derived:com.google.step_count.delta:com.google.fitkit:apple:iphone:858eb976:top_level',
            'derived:com.google.step_count.delta:com.google.ios.fit:appleinc.:iphone:eb06dcf7:top_level'
          ];
          
          // Also try to discover additional data sources
          console.log(`📊 Checking for additional step data sources...`);
          try {
            const dataSourcesResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${user.accessToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
            });
            
            if (dataSourcesResponse.ok) {
              const dataSourcesData = await dataSourcesResponse.json();
              console.log(`📊 All available data sources:`, JSON.stringify(dataSourcesData, null, 2));
              
              // Look for any step-related data sources we might have missed
              const stepDataSources = dataSourcesData.dataSource?.filter(ds => 
                ds.dataType?.name?.includes('step_count') || 
                ds.dataSourceId?.includes('step_count') ||
                ds.dataType?.name?.includes('steps')
              ) || [];
              
              console.log(`📊 Found ${stepDataSources.length} step-related data sources:`, stepDataSources.map(ds => ({
                dataSourceId: ds.dataSourceId,
                dataType: ds.dataType?.name,
                device: ds.device?.manufacturer,
                streamId: ds.streamId
              })));
              
              // Add any new step data sources to our list
              stepDataSources.forEach(ds => {
                if (ds.dataSourceId && !knownDataSources.includes(ds.dataSourceId)) {
                  knownDataSources.push(ds.dataSourceId);
                  console.log(`📊 Added new step data source: ${ds.dataSourceId}`);
                }
              });
            }
          } catch (discoveryError) {
            console.log(`📊 Error discovering additional data sources:`, discoveryError.message);
          }
          
          for (const dataSourceId of knownDataSources) {
            try {
              const startTimeNanos = startOfToday.getTime() * 1000000;
              const endTimeNanos = currentTime.getTime() * 1000000;
              const datasetUrl = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${startTimeNanos}-${endTimeNanos}`;
              
              console.log(`📊 Fetching from specific data source: ${dataSourceId}`);
              
              const sourceResponse = await fetch(datasetUrl, {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${user.accessToken}`,
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                },
              });
              
              if (sourceResponse.ok) {
                const sourceData = await sourceResponse.json();
                console.log(`📊 Data source ${dataSourceId} response:`, JSON.stringify(sourceData, null, 2));
                
                                 if (sourceData.point && sourceData.point.length > 0) {
                   let sourceSteps = 0;
                   for (const point of sourceData.point) {
                     if (point.value && point.value.length > 0 && point.value[0].intVal) {
                       const pointStartTime = parseInt(point.startTimeNanos) / 1000000;
                       const pointEndTime = parseInt(point.endTimeNanos) / 1000000;
                       
                       // Only count steps that fall within our time range (3 AM to current time today)
                       if (pointStartTime >= startOfToday.getTime() && pointEndTime <= currentTime.getTime()) {
                         sourceSteps += point.value[0].intVal;
                         console.log(`📊 Adding ${point.value[0].intVal} steps from ${dataSourceId} at ${new Date(pointStartTime).toISOString()} (within time range)`);
                       } else {
                         console.log(`📊 Skipping ${point.value[0].intVal} steps from ${dataSourceId} at ${new Date(pointStartTime).toISOString()} (outside time range: ${new Date(pointStartTime).toISOString()} to ${new Date(pointEndTime).toISOString()})`);
                       }
                     }
                   }
                   console.log(`📊 Total steps from ${dataSourceId} (filtered for time range): ${sourceSteps}`);
                   
                   if (sourceSteps > steps) {
                     steps = sourceSteps;
                     console.log(`📊 Updated total steps to ${steps} from ${dataSourceId}`);
                   }
                 }
              } else {
                console.log(`📊 Data source ${dataSourceId} error: HTTP ${sourceResponse.status}`);
              }
            } catch (sourceError) {
              console.log(`📊 Error fetching from ${dataSourceId}:`, sourceError.message);
            }
          }
        } catch (specificError) {
          console.log(`📊 Specific data source fetching error:`, specificError.message);
        }
      }
    } catch (aggregateError) {
      console.log(`📊 Aggregate API error:`, aggregateError.message);
      console.log(`📊 Aggregate API error stack:`, aggregateError.stack);
    }
    
    // Always try individual data sources to get the most recent data, regardless of aggregate results
    console.log(`🔄 Trying individual data sources for fresh data...`);
    console.log(`📊 Current steps value before individual sources: ${steps}`);
    console.log(`📊 TEST: Individual data source section reached`);
    
    try {
      console.log(`📊 TEST: Inside try block for data sources`);
      console.log(`📊 Fetching data sources list...`);
      const dataSourcesResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      
      console.log(`📊 Data sources response status: ${dataSourcesResponse.status}`);
        
        if (dataSourcesResponse.ok) {
          const dataSources = await dataSourcesResponse.json();
          console.log(`📊 Found ${dataSources.dataSource?.length || 0} data sources`);
          
          // Log all data sources for debugging
          console.log(`📊 All data sources:`, dataSources.dataSource?.map(ds => ({
            streamId: ds.streamId,
            dataType: ds.dataType.name,
            device: ds.device?.manufacturer || 'unknown',
            dataSourceId: ds.dataSourceId
          })));
          
          // Find step count data sources
          const stepDataSources = dataSources.dataSource?.filter(ds => 
            ds.dataType.name === 'com.google.step_count.delta' || 
            ds.dataType.name === 'com.google.step_count.cumulative'
          ) || [];
          
          console.log(`📊 Step data sources found:`, stepDataSources.map(ds => ({
            streamId: ds.streamId,
            dataType: ds.dataType.name,
            device: ds.device?.manufacturer || 'unknown',
            dataSourceId: ds.dataSourceId
          })));
          
          // Filter out sources with undefined dataSourceId
          const validStepDataSources = stepDataSources.filter(ds => ds.dataSourceId);
          console.log(`📊 Valid step data sources (with dataSourceId):`, validStepDataSources.length);
          
          if (validStepDataSources.length === 0) {
            console.log(`📊 No valid step data sources found! All step sources:`, stepDataSources.map(ds => ({
              dataSourceId: ds.dataSourceId,
              dataType: ds.dataType.name,
              device: ds.device?.manufacturer || 'unknown'
            })));
          }
          
          // Try each step data source
          console.log(`📊 Starting individual data source fetching for ${validStepDataSources.length} sources...`);
          for (const dataSource of validStepDataSources) {
            try {
              const startTimeNanos = startOfToday.getTime() * 1000000;
              const endTimeNanos = currentTime.getTime() * 1000000;
              const datasetUrl = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(dataSource.dataSourceId)}/datasets/${startTimeNanos}-${endTimeNanos}`;
              
              console.log(`📊 Fetching step data from: ${dataSource.dataSourceId} (${dataSource.dataType.name})`);
              
              const stepResponse = await fetch(datasetUrl, {
                headers: {
                  Authorization: `Bearer ${user.accessToken}`,
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                },
              });
              
              if (stepResponse.ok) {
                const stepData = await stepResponse.json();
                console.log(`📊 Step data from ${dataSource.dataSourceId}:`, stepData);
                
                if (stepData.point && stepData.point.length > 0) {
                  // For delta data, sum all points for today
                  if (dataSource.dataType.name === 'com.google.step_count.delta') {
                    const totalSteps = stepData.point.reduce((total, point) => {
                      return total + (point.value?.[0]?.intVal || 0);
                    }, 0);
                    
                    console.log(`📊 Delta steps from ${dataSource.dataSourceId}: ${totalSteps}`);
                    
                    // Use the first reasonable delta value we find
                    if (totalSteps > 0 && totalSteps <= 50000) {
                      steps = totalSteps;
                      console.log(`📊 Using delta steps: ${steps} from ${dataSource.dataSourceId}`);
                      break;
                    }
                  }
                  
                  // For cumulative data, get the last point of the day
                  if (dataSource.dataType.name === 'com.google.step_count.cumulative') {
                    const lastPoint = stepData.point[stepData.point.length - 1];
                    const cumulativeSteps = lastPoint.value?.[0]?.intVal || 0;
                    
                    console.log(`📊 Cumulative steps from ${dataSource.dataSourceId}: ${cumulativeSteps}`);
                    
                    // Use cumulative if it's reasonable and we don't have delta data
                    if (cumulativeSteps > 0 && cumulativeSteps <= 50000 && steps === 0) {
                      steps = cumulativeSteps;
                      console.log(`📊 Using cumulative steps: ${steps} from ${dataSource.dataSourceId}`);
                      break;
                    }
                  }
                }
              } else {
                const errorText = await stepResponse.text();
                console.log(`📊 Step data error from ${dataSource.dataSourceId}: HTTP ${stepResponse.status} - ${errorText}`);
              }
            } catch (stepError) {
              console.log(`📊 Error getting data from ${dataSource.dataSourceId}:`, stepError.message);
            }
          }
        }
      } catch (dataSourcesError) {
        console.log(`📊 Error getting data sources:`, dataSourcesError.message);
        console.log(`📊 Data sources error stack:`, dataSourcesError.stack);
      }
      
      console.log(`📊 Individual data source fetching completed. Final steps value: ${steps}`);
     
         // Always try to get the most recent data, even if we have some steps
    console.log(`🔄 Checking for more recent data in individual sources...`);
    if (steps === 0 || steps < 1000) { // Also try if we have very low step count (likely stale data)
       console.log(`🔄 No steps found for today, checking last 7 days for any step data...`);
       
       try {
         // For the 7-day fallback, still use today's range but look at the last 7 days
         const sevenDaysAgo = new Date(userLocalTime.getTime() - (7 * 24 * 60 * 60 * 1000));
         
         const weekResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
           method: 'POST',
           headers: {
             Authorization: `Bearer ${user.accessToken}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             aggregateBy: [
               { dataTypeName: 'com.google.step_count.delta' }
             ],
             bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
             startTimeMillis: sevenDaysAgo.getTime(),
             endTimeMillis: currentTime.getTime()
           }),
         });
         
         if (weekResponse.ok) {
           const weekData = await weekResponse.json();
           console.log(`📊 7-day step data:`, JSON.stringify(weekData, null, 2));
           
           if (weekData.bucket && weekData.bucket.length > 0) {
             console.log(`📊 Found ${weekData.bucket.length} days of step data`);
             
             // Collect all step data with timestamps
             const allWeekStepData = [];
             
             for (let i = 0; i < weekData.bucket.length; i++) {
               const bucket = weekData.bucket[i];
               const stepsData = bucket.dataset?.find(d => 
                 d.dataTypeName === 'com.google.step_count.delta' || 
                 d.dataTypeName === 'com.google.step_count.cumulative'
               );
               
               if (stepsData?.point?.[0]?.value?.[0]?.intVal) {
                 const daySteps = stepsData.point[0].value[0].intVal;
                 const bucketStart = new Date(bucket.startTimeMillis);
                 const dataSource = stepsData.point[0].originDataSourceId || 'unknown';
                 
                 allWeekStepData.push({
                   steps: daySteps,
                   date: bucketStart,
                   dataSource: dataSource
                 });
                 
                 console.log(`📊 Found ${daySteps} steps on ${bucketStart.toDateString()} (${dataSource})`);
               }
             }
             
             // Sort by date to get the most recent
             allWeekStepData.sort((a, b) => b.date - a.date);
             
             if (allWeekStepData.length > 0) {
               // Log all available data for debugging
               console.log(`📊 All week step data available:`, allWeekStepData.map(data => ({
                 steps: data.steps,
                 date: data.date.toDateString(),
                 dataSource: data.dataSource
               })));
               
               // Get today's date in user's timezone
               const today = new Date(userLocalTime.getFullYear(), userLocalTime.getMonth(), userLocalTime.getDate());
               
               // Sum up all step data for today
               const todayData = allWeekStepData.filter(data => {
                 const dataDate = new Date(data.date.getFullYear(), data.date.getMonth(), data.date.getDate());
                 const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                 const isToday = dataDate.getTime() === todayDate.getTime();
                 
                 console.log(`📊 7-day data: Comparing ${dataDate.toDateString()} vs ${todayDate.toDateString()} = ${isToday} (${data.steps} steps)`);
                 return isToday;
               });
               
               console.log(`📊 Today's step data buckets:`, todayData.map(data => ({
                 steps: data.steps,
                 date: data.date.toDateString(),
                 dataSource: data.dataSource
               })));
               
               if (todayData.length > 0) {
                 // Sum up all steps for today
                 const totalTodaySteps = todayData.reduce((total, data) => total + data.steps, 0);
                 console.log(`📊 Total steps for today: ${totalTodaySteps} (sum of ${todayData.length} buckets)`);
                 
                 // If we have a reasonable step count, use it
                 if (totalTodaySteps > 1000) {
                   steps = totalTodaySteps;
                   console.log(`📊 Using 7-day data for today: ${steps} steps`);
                 } else {
                   console.log(`📊 7-day data also shows low step count (${totalTodaySteps}), keeping original value`);
                 }
               } else {
                 // Fall back to most recent data if no today data found
                 const mostRecent = allWeekStepData[0];
                 steps = mostRecent.steps;
                 console.log(`📊 Using most recent step data from ${mostRecent.date.toDateString()}: ${steps} (${mostRecent.dataSource})`);
               }
             }
           }
         }
       } catch (weekError) {
         console.log(`📊 7-day data check error:`, weekError.message);
       }
     }
    
    // Get weight data
    try {
      console.log(`🔄 Fetching weight data...`);
      
      // Look for weight data from the last 30 days (keep this wide range for weight)
      const weightStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const weightResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: 'com.google.weight' }
          ],
          bucketByTime: { durationMillis: 30 * 24 * 60 * 60 * 1000 },
          startTimeMillis: weightStartTime.getTime(),
          endTimeMillis: endOfToday.getTime()
        }),
      });
      
      if (weightResponse.ok) {
        const weightData = await weightResponse.json();
        console.log(`📊 Weight aggregate response:`, JSON.stringify(weightData, null, 2));
        
        if (weightData.bucket && weightData.bucket.length > 0) {
          console.log(`📊 Found ${weightData.bucket.length} weight buckets`);
          
          // Store all weight data in FitnessHistory
          const FitnessHistory = require('./models/FitnessHistory');
          let weightsStored = 0;
          
          for (const bucket of weightData.bucket) {
            const bucketStartMillis = bucket.startTimeMillisNanos ? 
              parseInt(bucket.startTimeMillisNanos) / 1000000 : 
              bucket.startTimeMillis;
            const bucketDate = FitnessHistory.normalizeDate(new Date(bucketStartMillis));
            
            const weightDataset = bucket.dataset?.find(d => 
              d.dataTypeName === 'com.google.weight' || 
              d.dataSourceId?.includes('weight')
            );
            
            if (weightDataset && weightDataset.point && weightDataset.point.length > 0) {
              // Get the most recent weight point for this day
              const latestWeightPoint = weightDataset.point[weightDataset.point.length - 1];
              if (latestWeightPoint.value && latestWeightPoint.value.length > 0) {
                const weightValue = latestWeightPoint.value[latestWeightPoint.value.length - 1];
                if (weightValue.fpVal !== undefined && weightValue.fpVal > 0) {
                  let dayWeight = weightValue.fpVal;
                  // Convert from kg to lbs if needed
                  if (dayWeight < 150) {
                    dayWeight = dayWeight * 2.20462;
                  }
                  
                  const storedWeight = Math.round(dayWeight * 100) / 100;
                  await FitnessHistory.findOneAndUpdate(
                    { userId: googleId, date: bucketDate },
                    {
                      $set: {
                        weight: storedWeight,
                        source: 'google-fit',
                        updatedAt: new Date()
                      },
                      $setOnInsert: {
                        userId: googleId,
                        date: bucketDate,
                        steps: 0,
                        createdAt: new Date()
                      }
                    },
                    { upsert: true }
                  );
                  weightsStored++;
                  console.log(`📊 Stored weight ${storedWeight} lbs in FitnessHistory for ${bucketDate.toISOString().split('T')[0]}`);
                }
              }
            }
          }
          
          console.log(`✅ Stored ${weightsStored} weight entries in FitnessHistory`);
          
          // Look for the most recent bucket with weight data for user.weight
          for (let i = weightData.bucket.length - 1; i >= 0; i--) {
            const bucket = weightData.bucket[i];
            console.log(`📊 Checking weight bucket ${i}:`, JSON.stringify(bucket, null, 2));
            
            if (!bucket.dataset || bucket.dataset.length === 0) {
              console.log(`📊 No datasets found in weight bucket ${i}`);
              continue;
            }
            
            console.log(`📊 Found ${bucket.dataset.length} datasets in weight bucket ${i}`);
            
            // Look for any dataset that contains weight data
            const weightDataset = bucket.dataset.find(d => 
              d.dataTypeName === 'com.google.weight' || 
              d.dataSourceId?.includes('weight')
            );
            
            if (weightDataset) {
              console.log(`📊 Weight dataset found in bucket ${i}:`, JSON.stringify(weightDataset, null, 2));
              
              if (weightDataset.point && weightDataset.point.length > 0) {
                console.log(`📊 Found ${weightDataset.point.length} weight data points in bucket ${i}`);
                
                                 // Get the most recent weight point
                 const latestWeightPoint = weightDataset.point[weightDataset.point.length - 1];
                 console.log(`📊 Latest weight point:`, JSON.stringify(latestWeightPoint, null, 2));
                 
                 if (latestWeightPoint.value && latestWeightPoint.value.length > 0) {
                   // Use the LAST value in the array (most recent weight entry)
                   const weightValue = latestWeightPoint.value[latestWeightPoint.value.length - 1];
                   console.log(`📊 Weight value object (most recent):`, JSON.stringify(weightValue, null, 2));
                   
                   if (weightValue.fpVal !== undefined && weightValue.fpVal > 0) {
                     weight = weightValue.fpVal;
                     const bucketStart = new Date(bucket.startTimeMillis);
                     console.log(`📊 Found weight from aggregate API: ${weight} from ${bucketStart.toDateString()}`);
                     break; // Use the most recent weight we found
                   } else {
                     console.log(`📊 No valid fpVal found in weight value`);
                   }
                 } else {
                   console.log(`📊 No values found in latest weight point`);
                 }
              } else {
                console.log(`📊 No points found in weight dataset`);
              }
            } else {
              console.log(`📊 No weight dataset found in bucket ${i}`);
              console.log(`📊 Available datasets in bucket ${i}:`, bucket.dataset.map(d => ({ 
                dataTypeName: d.dataTypeName, 
                dataSourceId: d.dataSourceId 
              })));
              
              // Try to find any dataset with weight data by checking all datasets
              for (const dataset of bucket.dataset) {
                if (dataset.point && dataset.point.length > 0) {
                  const latestPoint = dataset.point[dataset.point.length - 1];
                  if (latestPoint.value && latestPoint.value.length > 0) {
                    const weightValue = latestPoint.value[0];
                    if (weightValue.fpVal !== undefined && weightValue.fpVal > 0) {
                      weight = weightValue.fpVal;
                      const bucketStart = new Date(bucket.startTimeMillis);
                      console.log(`📊 Found weight from alternative search: ${weight} from ${bucketStart.toDateString()} in dataset ${dataset.dataSourceId}`);
                      break;
                    }
                  }
                }
              }
              if (weight !== null) break; // Exit the bucket loop if we found weight
            }
          }
        } else {
          console.log(`📊 No weight buckets found in response`);
        }
      } else {
        console.log(`📊 Weight aggregate API failed, trying individual sources...`);
        
        // Try individual weight data sources
        const dataSourcesResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
          },
        });
        
        if (dataSourcesResponse.ok) {
          const dataSources = await dataSourcesResponse.json();
          const weightDataSources = dataSources.dataSource?.filter(ds => 
            ds.dataType.name === 'com.google.weight'
          ) || [];
          
          for (const dataSource of weightDataSources) {
            try {
              const weightStartTimeNanos = weightStartTime.getTime() * 1000000;
              const endTimeNanos = endOfToday.getTime() * 1000000;
              const weightDatasetUrl = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(dataSource.dataSourceId)}/datasets/${weightStartTimeNanos}-${endTimeNanos}`;
              
              const individualWeightResponse = await fetch(weightDatasetUrl, {
                headers: {
                  Authorization: `Bearer ${user.accessToken}`,
                },
              });
              
              if (individualWeightResponse.ok) {
                const individualWeightData = await individualWeightResponse.json();
                
                if (individualWeightData.point && individualWeightData.point.length > 0) {
                  const latestWeightPoint = individualWeightData.point[individualWeightData.point.length - 1];
                  const weightValue = latestWeightPoint.value?.[0]?.fpVal;
                  
                  if (weightValue !== undefined && weightValue > 0) {
                    weight = weightValue;
                    console.log(`📊 Found weight: ${weight} from ${dataSource.dataSourceId}`);
                    break;
                  }
                }
              }
            } catch (weightError) {
              console.log(`📊 Error getting weight from ${dataSource.dataSourceId}:`, weightError.message);
            }
          }
        }
      }
    } catch (weightError) {
      console.log(`📊 Weight fetch error:`, weightError.message);
    }

    console.log(`📊 Final extracted data - Steps: ${steps}, Weight: ${weight}`);

    // Convert weight from kg to pounds if it's in kg (Google Fit returns kg)
    if (weight && weight < 150) {
      const weightInPounds = weight * 2.20462;
      console.log(`📊 Converting weight from ${weight} kg to ${weightInPounds.toFixed(1)} lbs`);
      weight = weightInPounds;
    }

    // Update user in DB
    user.steps = steps;
    user.weight = weight;
    user.lastSync = new Date();
    await user.save();

    // Update ChallengeParticipant records for this user
    try {
      const FitnessHistory = require('./models/FitnessHistory');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const normalizedDate = FitnessHistory.normalizeDate(today);
      
      // Check if there's a manual weight entry for today (manual entries take precedence)
      // Also check for ANY entry for today to see what exists
      const allEntriesToday = await FitnessHistory.find({
        userId: googleId,
        date: normalizedDate
      });
      
      // Try to find manual entry by exact date match first
      let manualWeightEntry = await FitnessHistory.findOne({
        userId: googleId,
        date: normalizedDate,
        source: 'manual'
      });
      
      // Fallback: If no manual entry found by date, check for manual entries created today
      // This handles edge cases where date normalization might differ slightly
      if (!manualWeightEntry) {
        const todayStart = new Date(normalizedDate);
        const todayEnd = new Date(normalizedDate);
        todayEnd.setHours(23, 59, 59, 999);
        
        manualWeightEntry = await FitnessHistory.findOne({
          userId: googleId,
          source: 'manual',
          createdAt: { $gte: todayStart, $lte: todayEnd }
        });
        
        if (manualWeightEntry) {
          console.log(`📊 Found manual entry via createdAt fallback: ${manualWeightEntry.weight} lbs (date: ${manualWeightEntry.date?.toISOString()})`);
        }
      }
      
      const participants = await ChallengeParticipant.find({ userId: googleId });
      console.log(`🔍 Found ${participants.length} challenge participations for user ${user.email}`);
      
      for (const participant of participants) {
        // Store original startingWeight to ensure it's never overwritten
        const originalStartingWeight = participant.startingWeight;
        const originalLastWeight = participant.lastWeight;
        
        // Update step data
        participant.lastStepCount = steps;
        participant.lastStepDate = new Date();
        
        // Update weight data - but don't overwrite if there's a manual entry for today
        // Also never overwrite startingWeight (it's set once on first weigh-in day)
        // CRITICAL: If there's a manual entry for today, NEVER overwrite participant.lastWeight
        // ALSO: If participant.lastWeight differs significantly from Google Fit weight, preserve it (likely manually set)
        
        // Check if there's ANY manual entry created/updated in the last 24 hours (safety net)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentManualEntry = await FitnessHistory.findOne({
          userId: googleId,
          source: 'manual',
          $or: [
            { createdAt: { $gte: oneDayAgo } },
            { updatedAt: { $gte: oneDayAgo } }
          ]
        }).sort({ updatedAt: -1 });
        
        if (manualWeightEntry && manualWeightEntry.weight !== null && manualWeightEntry.weight !== undefined) {
          // Use manual weight if it exists - DO NOT overwrite with Google Fit weight
          const manualWeight = manualWeightEntry.weight;
          if (participant.lastWeight !== manualWeight) {
            participant.lastWeight = manualWeight;
            console.log(`📊 Using manual weight entry (${manualWeight} lbs) instead of Google Fit weight (${weight} lbs). Updated participant.lastWeight from ${originalLastWeight || 'null'} to ${manualWeight}`);
          } else {
            console.log(`📊 Manual weight entry exists (${manualWeight} lbs), keeping participant.lastWeight at ${participant.lastWeight}`);
          }
        } else if (recentManualEntry && recentManualEntry.weight !== null && recentManualEntry.weight !== undefined) {
          // Found a recent manual entry (within 24 hours) - use it even if date doesn't match exactly
          const manualWeight = recentManualEntry.weight;
          if (participant.lastWeight !== manualWeight) {
            participant.lastWeight = manualWeight;
            console.log(`📊 Using recent manual weight entry (${manualWeight} lbs, updated: ${recentManualEntry.updatedAt?.toISOString()}) instead of Google Fit weight (${weight} lbs). Updated participant.lastWeight from ${originalLastWeight || 'null'} to ${manualWeight}`);
          } else {
            console.log(`📊 Recent manual weight entry exists (${manualWeight} lbs), keeping participant.lastWeight at ${participant.lastWeight}`);
          }
        } else if (weight && !manualWeightEntry && !recentManualEntry) {
          // Check if participant.lastWeight differs significantly from Google Fit weight
          // If it does, it was likely manually set - preserve it
          const weightDiff = Math.abs((participant.lastWeight || 0) - weight);
          if (participant.lastWeight !== null && participant.lastWeight !== undefined && weightDiff > 0.5) {
            // Weight differs by more than 0.5 lbs - likely manually set, preserve it
            console.log(`📊 Preserving participant.lastWeight (${participant.lastWeight} lbs) - differs from Google Fit weight (${weight} lbs) by ${weightDiff.toFixed(2)} lbs. Likely manually set.`);
          } else {
            // No significant difference or no existing weight - update with Google Fit weight
            participant.lastWeight = weight;
            console.log(`📊 No manual entry found and no significant difference, updating participant.lastWeight to Google Fit weight: ${weight} lbs`);
          }
        } else {
          // Keep existing weight if no manual entry and no Google Fit weight, or if manual entry has no weight
          console.log(`📊 Keeping existing participant.lastWeight: ${participant.lastWeight || 'null'} (manualEntry: ${!!manualWeightEntry}, recentManualEntry: ${!!recentManualEntry}, googleFitWeight: ${weight || 'null'})`);
        }
        
        // CRITICAL: Ensure startingWeight is never overwritten (it's set once on first weigh-in day)
        if (participant.startingWeight !== originalStartingWeight) {
          console.log(`⚠️ WARNING: startingWeight was changed during sync, restoring original value`);
          participant.startingWeight = originalStartingWeight;
        }
        
        await participant.save();
        console.log(`✅ Updated participant data for challenge ${participant.challengeId}: steps=${steps}, weight=${participant.lastWeight || weight || 'N/A'}, startingWeight=${participant.startingWeight || 'not set'}`);
      }
    } catch (participantError) {
      console.log(`⚠️ Error updating participant records:`, participantError.message);
    }

    // Store weight in FitnessHistory for today if weight exists
    // BUT: Don't overwrite manual entries (manual entries take precedence)
    if (weight) {
      try {
        const FitnessHistory = require('./models/FitnessHistory');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Normalize date to start of day (same as FitnessHistory.normalizeDate)
        const normalizedDate = FitnessHistory.normalizeDate(today);
        
        // Check if there's already a manual entry for today
        // Use findOne with source filter first to check specifically for manual entries
        const manualEntry = await FitnessHistory.findOne({
          userId: googleId,
          date: normalizedDate,
          source: 'manual'
        });
        
        // Also check for any existing entry (for logging)
        const existingEntry = await FitnessHistory.findOne({
          userId: googleId,
          date: normalizedDate
        });
        
        // CRITICAL: Never overwrite manual entries - they take absolute precedence
        if (manualEntry) {
          console.log(`📊 SKIPPING Google Fit weight update - manual entry exists for today (${manualEntry.weight} lbs, source: ${manualEntry.source}). Manual entries take precedence.`);
        } else if (!existingEntry || existingEntry.source !== 'manual') {
          // Only update if there's no manual entry
          await FitnessHistory.findOneAndUpdate(
            { userId: googleId, date: normalizedDate },
            {
              $set: {
                weight: weight,
                source: 'google-fit',
                updatedAt: new Date()
              },
              $setOnInsert: {
                userId: googleId,
                date: normalizedDate,
                steps: steps || 0,
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
          console.log(`✅ Stored weight ${weight} in FitnessHistory for ${normalizedDate.toISOString()} (source: google-fit)`);
        } else {
          console.log(`📊 Skipping Google Fit weight update - manual entry exists for today (${existingEntry.weight} lbs, source: ${existingEntry.source})`);
        }
      } catch (historyError) {
        console.log(`⚠️ Error storing weight in FitnessHistory:`, historyError.message);
      }
    }

    console.log(`✅ Synced Google Fit data for ${user.email}: steps=${steps}, weight=${weight}`);

    // Broadcast update via SSE
    broadcastUserUpdate(user.googleId, {
      steps: user.steps,
      weight: user.weight,
      lastSync: user.lastSync
    });

    res.json({ steps, weight, lastSync: user.lastSync });
  } catch (err) {
    console.error('❌ Google Fit sync error:', err);
    res.status(500).json({ error: 'Failed to fetch Google Fit data', details: err.message });
  }
});

// Get user data (steps, weight, lastSync)
app.get('/api/user-data/:googleId', authenticateJWT, async (req, res) => {
  const { googleId } = req.params;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId parameter' });
  }

  try {
    const user = await User.findOne({ googleId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`📊 Retrieved user data for ${user.email}: steps=${user.steps}, weight=${user.weight}, lastSync=${user.lastSync}`);
    
    res.json({ 
      steps: user.steps, 
      weight: user.weight, 
      lastSync: user.lastSync 
    });
  } catch (err) {
    console.error('Failed to get user data:', err);
    res.status(500).json({ error: 'Failed to get user data', details: err.message });
  }
});

// Get challenges that a user is participating in
app.get('/api/user-challenges/:googleId', authenticateJWT, async (req, res) => {
  const { googleId } = req.params;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId parameter' });
  }

  try {
    console.log(`🔍 Looking for challenges for user: ${googleId}`);
    
    // Find all challenges where this user is a participant
    const participants = await ChallengeParticipant.find({ userId: googleId });
    console.log(`🔍 Found ${participants.length} participant records for user ${googleId}`);
    
    // Also check if user exists and what their email is
    const user = await User.findOne({ googleId: googleId });
    if (user) {
      console.log(`🔍 User found: ${user.email} (${user.name})`);
      
      // Check if there are challenges where user email is in participants array
      const challengesByEmail = await Challenge.find({ participants: user.email });
      console.log(`🔍 Found ${challengesByEmail.length} challenges where user email is in participants array`);
      
      // FIX: If user is in Challenge.participants array but has no ChallengeParticipant record, create one
      for (const challenge of challengesByEmail) {
        const existingParticipant = await ChallengeParticipant.findOne({
          challengeId: challenge._id.toString(),
          userId: googleId
        });
        
        if (!existingParticipant) {
          console.log(`⚠️ User ${user.email} is in challenge "${challenge.name}" participants array but has no ChallengeParticipant record. Creating one...`);
          
          // Create participant record with default values
          // For startingWeight: set to null - it will be set on first weigh-in day
          // For lastWeight: use most recent weight if available, otherwise null
          const FitnessHistory = require('./models/FitnessHistory');
          const mostRecentWeight = await FitnessHistory.findOne(
            { userId: googleId, weight: { $ne: null } },
            {},
            { sort: { date: -1 } }
          );
          
          // Check if challenge has started and if first weigh-in day has passed
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const challengeStart = challenge.startDate ? new Date(challenge.startDate) : null;
          if (challengeStart) {
            challengeStart.setHours(0, 0, 0, 0);
          }
          const challengeHasStarted = challengeStart && today >= challengeStart;
          
          // Calculate first weigh-in day
          let firstWeighInDayHasPassed = false;
          if (challengeHasStarted && challenge.weighInDay) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const firstWeighInDay = new Date(challengeStart);
            const startDayName = dayNames[firstWeighInDay.getDay()];
            const weighInDayIndex = dayNames.indexOf(challenge.weighInDay.toLowerCase());
            const startDayIndex = dayNames.indexOf(startDayName);
            
            let daysUntilWeighIn = (weighInDayIndex - startDayIndex + 7) % 7;
            if (daysUntilWeighIn === 0 && startDayName === challenge.weighInDay.toLowerCase()) {
              daysUntilWeighIn = 0;
            }
            
            firstWeighInDay.setDate(firstWeighInDay.getDate() + daysUntilWeighIn);
            firstWeighInDay.setHours(0, 0, 0, 0);
            firstWeighInDayHasPassed = today >= firstWeighInDay;
          }
          
          // Only set startingWeight if challenge has started AND first weigh-in day has passed
          // Otherwise, it will be set when user confirms weight on first weigh-in day
          const startingWeightToSet = (challengeHasStarted && firstWeighInDayHasPassed && mostRecentWeight?.weight) 
            ? mostRecentWeight.weight 
            : null;
          
          const lastWeightToSet = mostRecentWeight?.weight || user.weight || null;
          
          const newParticipant = new ChallengeParticipant({
            challengeId: challenge._id.toString(),
            userId: googleId,
            startingWeight: startingWeightToSet, // null until confirmed on first weigh-in day
            lastWeight: lastWeightToSet,
            points: 0,
            stepGoalPoints: 0,
            weightLossPoints: 0
          });
          await newParticipant.save();
          console.log(`✅ Created ChallengeParticipant record for ${user.email} in "${challenge.name}" with startingWeight: ${startingWeightToSet || 'null (will be set on first weigh-in day)'}, lastWeight: ${lastWeightToSet || 'null'}`);
          
          // Add to participants array for this query
          participants.push(newParticipant);
        }
      }
      
      // Check specifically for "December Testing" challenge
      const decemberTesting = await Challenge.findOne({ name: 'December Testing' });
      if (decemberTesting) {
        console.log(`🔍 Found "December Testing" challenge: ${decemberTesting._id}`);
        const hasParticipantRecord = await ChallengeParticipant.findOne({ 
          challengeId: decemberTesting._id.toString(), 
          userId: googleId 
        });
        const isInParticipantsArray = decemberTesting.participants.includes(user.email);
        console.log(`🔍 December Testing: hasParticipantRecord=${!!hasParticipantRecord}, isInParticipantsArray=${isInParticipantsArray}, participants=${JSON.stringify(decemberTesting.participants)}`);
      }
    } else {
      console.log(`⚠️ User not found for googleId: ${googleId}`);
    }
    
    if (participants.length === 0) {
      console.log(`📊 No challenges found for user ${googleId}`);
      return res.json([]);
    }
    
    // Get the challenge IDs and convert to ObjectId if needed (after potential participant creation)
    const challengeIds = participants.map(p => {
      // ChallengeParticipant stores challengeId as string, but Challenge._id is ObjectId
      // Try to convert to ObjectId if it's a valid ObjectId string, otherwise use as-is
      try {
        if (mongoose.Types.ObjectId.isValid(p.challengeId)) {
          return new mongoose.Types.ObjectId(p.challengeId);
        }
        return p.challengeId;
      } catch (e) {
        return p.challengeId;
      }
    });
    console.log(`🔍 Challenge IDs (after fix):`, challengeIds);
    
    // Fetch the actual challenge data
    const challenges = await Challenge.find({ _id: { $in: challengeIds } });
    console.log(`🔍 Found ${challenges.length} challenges for user ${googleId}`);
    
    res.json(challenges);
  } catch (err) {
    console.error('Failed to get user challenges:', err);
    res.status(500).json({ error: 'Failed to get user challenges', details: err.message });
  }
});

// Get user rank across all challenges
app.get('/api/user-rank/:googleId', authenticateJWT, async (req, res) => {
  const { googleId } = req.params;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId parameter' });
  }

  try {
    console.log(`🏆 Getting rank for user: ${googleId}`);
    
    // Find all challenges where this user is a participant
    const participants = await ChallengeParticipant.find({ userId: googleId });
    
    if (participants.length === 0) {
      console.log(`📊 No challenges found for user ${googleId} - no rank available`);
      return res.json({ rank: null, totalParticipants: 0, message: 'Not participating in any challenges' });
    }
    
    let totalRank = 0;
    let totalParticipants = 0;
    let rankCount = 0;
    
    // Calculate rank for each challenge
    for (const participant of participants) {
      const challengeParticipants = await ChallengeParticipant.find({ 
        challengeId: participant.challengeId 
      }).sort({ points: -1 });
      
      const userRank = challengeParticipants.findIndex(p => p.userId === googleId) + 1;
      if (userRank > 0) {
        totalRank += userRank;
        totalParticipants += challengeParticipants.length;
        rankCount++;
      }
    }
    
    // Calculate average rank
    const averageRank = rankCount > 0 ? Math.round(totalRank / rankCount) : null;
    
    console.log(`🏆 User ${googleId} average rank: ${averageRank} out of ${totalParticipants} total participants across ${rankCount} challenges`);
    
    res.json({ 
      rank: averageRank,
      totalParticipants: totalParticipants,
      challengeCount: rankCount,
      message: averageRank ? `Rank ${averageRank} of ${totalParticipants}` : 'No rank available'
    });
  } catch (err) {
    console.error('Failed to get user rank:', err);
    res.status(500).json({ error: 'Failed to get user rank', details: err.message });
  }
});

// Update participant data with current fitness metrics
app.post('/api/update-participant/:challengeId/:googleId', async (req, res) => {
  const { challengeId, googleId } = req.params;
  
  if (!challengeId || !googleId) {
    return res.status(400).json({ error: 'Missing challengeId or googleId parameter' });
  }

  try {
    // Find the user
    const user = await User.findOne({ googleId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create the participant record
    let participant = await ChallengeParticipant.findOne({ 
      challengeId: challengeId,
      userId: googleId 
    });

    // Get the challenge to check step goal
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (!participant) {
      // Create new participant record
      participant = new ChallengeParticipant({
        challengeId: challengeId,
        userId: googleId,
        startingWeight: user.weight || 0,
        lastWeight: user.weight || 0,
        lastStepDate: user.lastSync || new Date(),
        lastStepCount: user.steps || 0,
        points: 0,
        stepGoalPoints: 0,
        weightLossPoints: 0,
        stepGoalDaysAchieved: 0
      });
    } else {
      // Update existing participant record with latest user data
      // IMPORTANT: Do NOT overwrite lastWeight if it's already set
      // The weight update endpoint (/api/challenge/:challengeId/participant/:userId/weight) is the authoritative source for weight updates
      // Only set lastWeight if it's null/undefined (initial case)
      
      if ((participant.lastWeight === undefined || participant.lastWeight === null) && 
          user.weight !== undefined && user.weight !== null && user.weight > 0) {
        participant.lastWeight = user.weight;
      }
      // Otherwise, keep the existing lastWeight (which may have been set via the weight update endpoint)
      
      participant.lastStepDate = user.lastSync || participant.lastStepDate;
      participant.lastStepCount = user.steps !== undefined && user.steps !== null ? user.steps : participant.lastStepCount;
    }

    // Recalculate weight loss points using last recorded weight (use current weight if available, otherwise use lastWeight)
    // If lastWeight is null, try to get the most recent weight from history
    if (participant.startingWeight) {
      // If lastWeight is not set, try to get the most recent weight from history
      if (participant.lastWeight === undefined || participant.lastWeight === null) {
        const mostRecentWeight = await FitnessHistory.findOne(
          { userId: googleId, weight: { $ne: null } },
          {},
          { sort: { date: -1 } }
        );
        
        if (mostRecentWeight && mostRecentWeight.weight) {
          participant.lastWeight = mostRecentWeight.weight;
          console.log(`📊 Set lastWeight from history in update-participant: ${mostRecentWeight.weight} lbs (from ${mostRecentWeight.date})`);
        } else {
          // Fallback to startingWeight if no history
          participant.lastWeight = participant.startingWeight;
          console.log(`📊 Set lastWeight to startingWeight (no history found): ${participant.startingWeight} lbs`);
        }
      }
      
      // Use lastWeight for calculation (don't use user.weight as it may be stale)
      // The weight update endpoint is the authoritative source for weight updates
      const currentWeight = participant.lastWeight;
      
      if (currentWeight !== undefined && currentWeight !== null && currentWeight > 0) {
        // Don't update lastWeight here - it should only be updated via the weight update endpoint
        // or when initially set (if null)
        
        const totalWeightLost = participant.startingWeight - currentWeight;
        const totalPercentLost = Math.max(0, (totalWeightLost / participant.startingWeight) * 100);
        const calculatedWeightLossPoints = roundWeightLossPoints(totalPercentLost);
        
        participant.weightLossPoints = calculatedWeightLossPoints;
      }
    }

    // Recalculate step goal points from FitnessHistory within challenge window
    if (challenge.startDate) {
      const stepGoalNum = getStepGoal(challenge);
      const startDate = FitnessHistory.normalizeDate(new Date(challenge.startDate));
      const today = FitnessHistory.normalizeDate(new Date());
      const endDateCandidate = challenge.endDate ? FitnessHistory.normalizeDate(new Date(challenge.endDate)) : today;
      const endDate = endDateCandidate < today ? endDateCandidate : today;

      const history = await FitnessHistory.find({
        userId: googleId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });

      let daysAchieved = 0;
      let latestAchievedDate = null;

      for (const entry of history) {
        if ((entry.steps || 0) >= stepGoalNum) {
          daysAchieved += 1;
          latestAchievedDate = entry.date;
        }
      }

      participant.stepGoalPoints = daysAchieved;
      participant.stepGoalDaysAchieved = daysAchieved;

      if (latestAchievedDate) {
        const normalizedLatest = FitnessHistory.normalizeDate(new Date(latestAchievedDate));
        participant.lastStepDate = normalizedLatest;
        participant.lastStepPointTimestamp = normalizedLatest;
      } else {
        participant.lastStepDate = participant.lastStepDate || null;
        participant.lastStepPointTimestamp = participant.lastStepPointTimestamp || null;
      }

      const latestHistory = history.length > 0 ? history[history.length - 1] : null;
      if (latestHistory && latestHistory.steps !== undefined && latestHistory.steps !== null) {
        participant.lastStepCount = latestHistory.steps;
      }

    }

    // Recalculate total points: step points + weight loss points
    const stepPoints = participant.stepGoalPoints || 0;
    const weightLossPoints = participant.weightLossPoints || 0;
    participant.points = stepPoints + weightLossPoints;

    await participant.save();

    console.log(`✅ Updated participant data for ${user.email} in challenge ${challengeId}: weight=${participant.lastWeight}, steps=${participant.lastStepCount}`);

    res.json({ 
      message: 'Participant data updated successfully',
      participant: {
        userId: participant.userId,
        startingWeight: participant.startingWeight,
        lastWeight: participant.lastWeight,
        lastStepDate: participant.lastStepDate,
        lastStepCount: participant.lastStepCount,
        points: participant.points
      }
    });
  } catch (err) {
    console.error('Failed to update participant data:', err);
    res.status(500).json({ error: 'Failed to update participant data', details: err.message });
  }
});

// Update challenge settings (admin only)
app.put('/api/challenge/:challengeId', async (req, res) => {
  const { challengeId } = req.params;
  const updateData = req.body;
  
  console.log('🔍 Challenge update request:', {
    challengeId: challengeId,
    updateData: updateData,
    params: req.params,
    body: req.body
  });
  
  if (!challengeId) {
    return res.status(400).json({ error: 'Missing challengeId parameter' });
  }

  try {
    // Find the challenge
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if user is admin (creator)
    console.log('🔍 Debug challenge update:', {
      userGoogleId: req.body.userGoogleId,
      challengeCreatorEmail: challenge.creatorEmail,
      challengeId: challengeId,
      participants: challenge.participants
    });
    
    const user = await User.findOne({ googleId: req.body.userGoogleId });
    console.log('🔍 Found user:', user ? { email: user.email, googleId: user.googleId } : 'User not found');
    
    // Check if user is creator or if creatorEmail is missing, check if user is in participants
    const isCreator = user && challenge.creatorEmail && user.email === challenge.creatorEmail;
    const isParticipant = user && challenge.participants && challenge.participants.includes(user.email);
    
    console.log('🔍 Authorization check:', {
      isCreator,
      isParticipant,
      userEmail: user?.email,
      challengeCreatorEmail: challenge.creatorEmail,
      participants: challenge.participants
    });
    
    if (!user || (!isCreator && !isParticipant)) {
      console.log('❌ Authorization failed:', {
        userFound: !!user,
        userEmail: user?.email,
        challengeCreatorEmail: challenge.creatorEmail,
        emailsMatch: user?.email === challenge.creatorEmail,
        isParticipant: isParticipant
      });
      return res.status(403).json({ error: 'Only challenge creator can update settings' });
    }

    // Check if this is a delete request
    if (updateData._delete) {
      console.log(`🗑️ Deleting challenge ${challengeId}`);
      
      // Delete all participant records for this challenge
      await ChallengeParticipant.deleteMany({ challengeId: challengeId });
      console.log(`🗑️ Deleted participant records for challenge ${challengeId}`);
      
      // Delete the challenge
      await Challenge.findByIdAndDelete(challengeId);
      console.log(`🗑️ Deleted challenge ${challengeId}`);
      
      res.json({ 
        message: 'Challenge deleted successfully',
        deleted: true
      });
      return;
    }

    // Update challenge fields
    const allowedFields = ['name', 'startDate', 'endDate', 'stepGoal', 'botName', 'botAvatar', 'isPublic'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        challenge[field] = updateData[field];
      }
    });

    await challenge.save();

    console.log(`✅ Updated challenge ${challengeId} settings`);

    res.json({ 
      message: 'Challenge updated successfully',
      challenge: challenge
    });
  } catch (err) {
    console.error('Failed to update challenge:', err);
    res.status(500).json({ error: 'Failed to update challenge', details: err.message });
  }
});



// Admin endpoint to add yesterday's step point for Dylan
app.post('/api/admin/add-yesterday-step-point', async (req, res) => {
  try {
    const userId = '105044462574652357380'; // Dylan's Google ID
    const challengeId = '6896b45176d78ebc85d22bf7'; // Challenge ID
    
    const participant = await ChallengeParticipant.findOne({ 
      userId: userId, 
      challengeId: challengeId 
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Add the additional step goal point for yesterday
    participant.points += 1;
    participant.stepGoalPoints = (participant.stepGoalPoints || 0) + 1;
    participant.stepGoalDaysAchieved = (participant.stepGoalDaysAchieved || 0) + 1;
    
    await participant.save();
    
    console.log('✅ Added yesterday\'s step goal point for Dylan');
    
    res.json({
      message: 'Successfully added yesterday\'s step goal point',
      participant: {
        points: participant.points,
        stepGoalPoints: participant.stepGoalPoints,
        weightLossPoints: participant.weightLossPoints,
        stepGoalDaysAchieved: participant.stepGoalDaysAchieved
      }
    });
  } catch (err) {
    console.error('❌ Error adding yesterday\'s step point:', err);
    res.status(500).json({ error: 'Failed to add step point', details: err.message });
  }
});

// Save user data from frontend OAuth flow
app.post('/api/save-user', async (req, res) => {
  const { googleId, name, email, picture, accessToken, refreshToken, tokenExpiry, steps, weight, date } = req.body;
  
  if (!googleId || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if user already exists to preserve custom profile data
    const existingUser = await User.findOne({ googleId });
    
    const updateData = {
      email,
      accessToken,
      refreshToken,
      tokenExpiry,
      lastSync: new Date()
    };
    
    // Preserve custom name if user exists (they may have changed it)
    // Only update name if user doesn't exist (new user)
    if (!existingUser) {
      updateData.name = name;
    } else {
      // Preserve existing name (may be custom)
      updateData.name = existingUser.name || name;
    }
    
    // Only update picture if:
    // 1. User doesn't exist (new user), OR
    // 2. User exists but has no picture, OR
    // 3. User's current picture is NOT a custom picture (data URL)
    // Custom pictures start with "data:image" and should never be overwritten by Google
    const isCustomPicture = existingUser?.picture && existingUser.picture.startsWith('data:image');
    if (!existingUser || !existingUser.picture || !isCustomPicture) {
      updateData.picture = picture;
    } else {
      // Preserve the existing custom picture (data URL)
      updateData.picture = existingUser.picture;
    }
    
    // Only update steps and weight if they are provided
    if (steps !== undefined) updateData.steps = steps;
    if (weight !== undefined) updateData.weight = weight;

    const user = await User.findOneAndUpdate(
      { googleId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    console.log(`✅ Saved user data for ${email} (${googleId}) with picture: ${picture ? 'yes' : 'no'}, steps: ${steps}, weight: ${weight}`);
    
    // Store historical data - use provided date or default to today
    if (steps !== undefined || weight !== undefined) {
      const targetDate = date ? FitnessHistory.normalizeDate(new Date(date)) : FitnessHistory.normalizeDate(new Date());
      await FitnessHistory.findOneAndUpdate(
        { userId: googleId, date: targetDate },
        {
          $set: {
            steps: steps !== undefined ? steps : 0,
            weight: weight !== undefined ? weight : null,
            source: 'sync',
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      console.log(`📊 Stored fitness history for ${email} on ${targetDate.toISOString()}: steps=${steps}, weight=${weight}`);
    }
    
    // Calculate challenge points if steps and weight are provided
    let pointsUpdates = [];
    if (steps !== undefined || weight !== undefined) {
      console.log(`🎯 Calculating points for user ${email}...`);
      
      // Find all challenges where this user is a participant
      const userParticipations = await ChallengeParticipant.find({ userId: googleId });
      console.log(`🔍 Found ${userParticipations.length} challenges for user ${email}`);
      
      for (const participation of userParticipations) {
        const challenge = await Challenge.findById(participation.challengeId);
        if (!challenge) {
          console.log(`⚠️ Challenge ${participation.challengeId} not found`);
          continue;
        }
        
        let pointsEarned = 0;
        let participant = participation; // Use existing participation record
        
        // Weight loss points - calculate continuously throughout the challenge
        // IMPORTANT: Do NOT overwrite lastWeight here - it should only be updated via the weight update endpoint
        // If lastWeight is null, try to get the most recent weight from history
        if (participant.startingWeight) {
          // If lastWeight is not set, try to get the most recent weight from history
          if ((participant.lastWeight === undefined || participant.lastWeight === null)) {
            const mostRecentWeight = await FitnessHistory.findOne(
              { userId: googleId, weight: { $ne: null } },
              {},
              { sort: { date: -1 } }
            );
            
            if (mostRecentWeight && mostRecentWeight.weight) {
              participant.lastWeight = mostRecentWeight.weight;
              console.log(`📊 Set lastWeight from history in save-user: ${mostRecentWeight.weight} lbs (from ${mostRecentWeight.date})`);
            } else if (weight !== undefined && weight !== null && weight > 0) {
              // Fallback to current weight if no history
              participant.lastWeight = weight;
              console.log(`📊 Set lastWeight from current weight in save-user: ${weight} lbs (no history found)`);
            }
          }
          
          // Use lastWeight for calculation (don't use weight parameter as it may be stale)
          const currentWeight = participant.lastWeight;
          
          if (currentWeight !== undefined && currentWeight !== null && currentWeight > 0) {
            // Calculate weight loss points continuously (not just at end)
            const totalWeightLost = participant.startingWeight - currentWeight;
            const totalPercentLost = Math.max(0, (totalWeightLost / participant.startingWeight) * 100);
            
            // Calculate weight loss points with custom rounding
            const expectedWeightLossPoints = roundWeightLossPoints(totalPercentLost);
            const currentWeightLossPoints = participant.weightLossPoints || 0;
            
            // Update weight loss points if they've changed
            if (expectedWeightLossPoints !== currentWeightLossPoints) {
              const pointsDifference = expectedWeightLossPoints - currentWeightLossPoints;
              participant.weightLossPoints = expectedWeightLossPoints;
              
              // Calculate total points: step points + weight loss points
              const stepPoints = participant.stepGoalPoints || 0;
              participant.points = stepPoints + expectedWeightLossPoints;
              
              if (pointsDifference > 0) {
                pointsEarned += pointsDifference;
                console.log(`🏆 Weight loss points updated: +${pointsDifference} (${totalPercentLost.toFixed(2)}% lost, ${totalWeightLost.toFixed(1)} lbs)`);
              } else {
                console.log(`📊 Weight loss points updated: ${pointsDifference} (${totalPercentLost.toFixed(2)}% lost, weight may have increased)`);
              }
              console.log(`📊 Total points: ${stepPoints} step points + ${expectedWeightLossPoints} weight loss = ${participant.points} total`);
            } else {
              // Weight loss points unchanged, but ensure total points are correct
              const stepPoints = participant.stepGoalPoints || 0;
              participant.points = stepPoints + expectedWeightLossPoints;
            }
          }
        }
        
        // Step goal points (once per calendar day)
        if (steps !== undefined) {
          const now = new Date();
          const lastStepPointTime = participant.lastStepPointTimestamp ? new Date(participant.lastStepPointTimestamp) : null;
          const canEarnPoint = has24HoursPassed(lastStepPointTime);
          const stepGoalNum = getStepGoal(challenge);
          
          console.log(`🔍 Step goal check for ${email}:`, {
            steps,
            stepGoal: stepGoalNum,
            reachedGoal: steps >= stepGoalNum,
            lastStepPointTime: lastStepPointTime?.toISOString(),
            canEarnPoint,
            hoursSinceLastPoint: lastStepPointTime ? ((now.getTime() - lastStepPointTime.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A',
            currentStepPoints: participant.stepGoalPoints || 0
          });
          
          // Update step count regardless of goal achievement
          participant.lastStepCount = steps;
          
          // Award point immediately when goal is reached (if 24 hours have passed)
          // IMPORTANT: Must meet or exceed the goal (steps >= challenge.stepGoal)
          if (canEarnPoint && steps >= stepGoalNum) {
            // Initialize fields if needed
            if (!participant.stepGoalPoints) participant.stepGoalPoints = 0;
            if (!participant.stepGoalDaysAchieved) participant.stepGoalDaysAchieved = 0;
            
            // Award the point
            participant.stepGoalPoints += 1;
            participant.stepGoalDaysAchieved += 1;
            participant.lastStepPointTimestamp = now; // Track exact timestamp for 24-hour window
            participant.lastStepDate = new Date(now); // Also update date for compatibility
            
            // Update total points: step points + weight loss points (always included)
            const stepPoints = participant.stepGoalPoints;
            const weightLossPoints = participant.weightLossPoints || 0;
            participant.points = stepPoints + weightLossPoints;
            
            pointsEarned += 1;
            console.log(`🏆 Step goal achieved! +1 point (${steps.toLocaleString()} steps >= ${stepGoalNum.toLocaleString()} goal)`);
            console.log(`📊 Updated: ${participant.stepGoalPoints} step points, ${participant.stepGoalDaysAchieved} days achieved`);
            console.log(`📊 Total points: ${participant.points} (${stepPoints} step + ${weightLossPoints} weight loss)`);
          } else if (!canEarnPoint && steps >= stepGoalNum) {
            console.log('✅ Step goal met but point already awarded today');
            // Still update total points to ensure consistency
            const stepPoints = participant.stepGoalPoints || 0;
            const weightLossPoints = participant.weightLossPoints || 0;
            participant.points = stepPoints + weightLossPoints;
          } else if (steps < stepGoalNum) {
            const remaining = stepGoalNum - steps;
            console.log(`📊 Step progress: ${steps.toLocaleString()}/${stepGoalNum.toLocaleString()} (${remaining.toLocaleString()} remaining) - Goal NOT met, no point awarded`);
            // Ensure points are correct even when goal not met
            const stepPoints = participant.stepGoalPoints || 0;
            const weightLossPoints = participant.weightLossPoints || 0;
            participant.points = stepPoints + weightLossPoints;
          }
        }
        
        await participant.save();
        pointsUpdates.push({ 
          challengeId: participation.challengeId, 
          points: participant.points, 
          pointsEarned 
        });
      }
      
      console.log(`📊 Points updates for ${email}:`, pointsUpdates);
    }
    
    // Broadcast update via SSE if steps or weight changed
    if (steps !== undefined || weight !== undefined) {
      broadcastUserUpdate(googleId, {
        steps: user.steps,
        weight: user.weight,
        lastSync: user.lastSync
      });
    }
    
    res.json({ 
      message: 'User saved successfully', 
      user: { googleId, name, email, picture, steps, weight },
      pointsUpdates 
    });
  } catch (err) {
    console.error('Failed to save user:', err);
    res.status(500).json({ error: 'Failed to save user', details: err.message });
  }
});

// Debug endpoint to check user's challenge participation
app.get('/api/debug/user/:googleId', async (req, res) => {
  const { googleId } = req.params;
  try {
    const user = await User.findOne({ googleId });
    const participations = await ChallengeParticipant.find({ userId: googleId });
    const challenges = [];
    
    for (const participation of participations) {
      const challenge = await Challenge.findById(participation.challengeId);
      challenges.push({
        challengeId: participation.challengeId,
        challengeName: challenge?.name || 'Unknown',
        stepGoal: challenge?.stepGoal || 'Unknown',
        participantPoints: participation.points,
        startingWeight: participation.startingWeight,
        lastWeight: participation.lastWeight,
        lastStepDate: participation.lastStepDate,
        lastStepCount: participation.lastStepCount
      });
    }
    
    res.json({
      user: user ? {
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        steps: user.steps,
        weight: user.weight,
        lastSync: user.lastSync
      } : null,
      participations: challenges
    });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to check if dbop1414 is properly removed from challenges
app.get('/api/admin/check-user-status/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`🔍 Checking status for user: ${email}`);
    
    // Find the user
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: `User ${email} not found` });
    }
    
    // Get challenges where user appears in participants array
    const challengesInArray = await Challenge.find({ participants: email });
    
    // Get participant records for this user
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    
    // Check each challenge for consistency
    let status = {
      user: {
        name: user.name,
        email: user.email,
        googleId: user.googleId
      },
      challengesInArray: challengesInArray.length,
      participantRecords: participantRecords.length,
      challenges: [],
      consistent: true
    };
    
    // Check each challenge the user appears in
    for (const challenge of challengesInArray) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      const challengeInfo = {
        id: challenge._id.toString(),
        name: challenge.name,
        admin: challenge.admin,
        isUserAdmin: challenge.admin === user.googleId,
        hasParticipantRecord: !!hasParticipantRecord,
        participantPoints: hasParticipantRecord?.points || 0
      };
      
      status.challenges.push(challengeInfo);
      
      if (!hasParticipantRecord) {
        status.consistent = false;
      }
    }
    
    // Check for orphaned participant records
    for (const participant of participantRecords) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        status.challenges.push({
          id: participant.challengeId.toString(),
          name: 'DELETED CHALLENGE',
          admin: 'N/A',
          isUserAdmin: false,
          hasParticipantRecord: true,
          participantPoints: participant.points,
          orphaned: true
        });
        status.consistent = false;
      } else if (!challenge.participants.includes(email)) {
        // Participant record exists but user not in challenge array
        const existingChallenge = status.challenges.find(c => c.id === challenge._id.toString());
        if (existingChallenge) {
          existingChallenge.inconsistent = true;
        } else {
          status.challenges.push({
            id: challenge._id.toString(),
            name: challenge.name,
            admin: challenge.admin,
            isUserAdmin: challenge.admin === user.googleId,
            hasParticipantRecord: true,
            participantPoints: participant.points,
            notInArray: true
          });
        }
        status.consistent = false;
      }
    }
    
    console.log(`📊 Status for ${email}:`, status);
    
    res.json(status);
    
  } catch (error) {
    console.error('❌ Error checking user status:', error);
    res.status(500).json({ error: 'Failed to check user status', details: error.message });
  }
});

// Debug endpoint to check dbop1414's challenge data
app.get('/api/admin/debug-stuck-user', async (req, res) => {
  try {
    const userEmail = 'dbop1414@gmail.com';
    
    console.log(`🔍 Debugging stuck user: ${userEmail}`);
    
    // Find the user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: `User ${userEmail} not found` });
    }
    
    console.log(`✅ Found user: ${user.name} (${user.googleId})`);
    
    // Get all participant records
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    
    // Get all challenges where user is in participants array
    const challengesWithUser = await Challenge.find({ participants: user.email });
    
    let debugInfo = {
      user: {
        name: user.name,
        email: user.email,
        googleId: user.googleId
      },
      participantRecords: [],
      challengesInArray: [],
      inconsistencies: []
    };
    
    // Check each participant record
    for (const participant of participantRecords) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      const recordInfo = {
        challengeId: participant.challengeId,
        challengeExists: !!challenge,
        challengeName: challenge?.name || 'DELETED',
        userInArray: challenge ? challenge.participants.includes(user.email) : false,
        points: participant.points
      };
      
      debugInfo.participantRecords.push(recordInfo);
      
      if (!challenge) {
        debugInfo.inconsistencies.push(`Orphaned participant record for challenge ${participant.challengeId}`);
      } else if (!challenge.participants.includes(user.email)) {
        debugInfo.inconsistencies.push(`User not in participants array for "${challenge.name}"`);
      }
    }
    
    // Check each challenge in array
    for (const challenge of challengesWithUser) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      const arrayInfo = {
        challengeId: challenge._id.toString(),
        challengeName: challenge.name,
        hasParticipantRecord: !!hasParticipantRecord,
        admin: challenge.admin,
        isUserAdmin: challenge.admin === user.googleId
      };
      
      debugInfo.challengesInArray.push(arrayInfo);
      
      if (!hasParticipantRecord) {
        debugInfo.inconsistencies.push(`Missing participant record for "${challenge.name}"`);
      }
    }
    
    console.log('🔍 Debug info:', debugInfo);
    
    res.json(debugInfo);
    
  } catch (error) {
    console.error('❌ Error debugging user:', error);
    res.status(500).json({ error: 'Failed to debug user', details: error.message });
  }
});

// Admin endpoint to fix dbop1414's stuck challenge issue
app.post('/api/admin/fix-stuck-user', async (req, res) => {
  try {
    const userEmail = 'dbop1414@gmail.com';
    
    console.log(`🔧 Fixing stuck user: ${userEmail}`);
    
    // Find the user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: `User ${userEmail} not found` });
    }
    
    console.log(`✅ Found user: ${user.name} (${user.googleId})`);
    
    let actions = [];
    
    // Find all participant records for this user
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    console.log(`📊 Found ${participantRecords.length} participant record(s)`);
    
    for (const participant of participantRecords) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        // Orphaned record - delete it
        console.log(`🗑️ Deleting orphaned participant record for challenge ${participant.challengeId}`);
        await ChallengeParticipant.findByIdAndDelete(participant._id);
        actions.push(`Deleted orphaned record for challenge ${participant.challengeId}`);
      } else {
        console.log(`✅ Challenge "${challenge.name}" exists`);
        
        // Check if user is in participants array
        if (!challenge.participants.includes(user.email)) {
          console.log(`🔧 Adding ${user.email} to challenge participants array`);
          challenge.participants.push(user.email);
          await challenge.save();
          actions.push(`Added user to "${challenge.name}" participants array`);
        }
      }
    }
    
    // Check for challenges where user is in array but missing participant record
    const challengesWithUser = await Challenge.find({ participants: user.email });
    console.log(`📋 Found ${challengesWithUser.length} challenge(s) with user in participants array`);
    
    for (const challenge of challengesWithUser) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      if (!hasParticipantRecord) {
        console.log(`🔧 Creating missing participant record for challenge "${challenge.name}"`);
        
        const newParticipant = new ChallengeParticipant({
          challengeId: challenge._id,
          userId: user.googleId,
          startingWeight: user.weight || 0,
          lastWeight: user.weight || 0,
          lastStepDate: user.lastSync || new Date(),
          lastStepCount: user.steps || 0,
          points: 0,
          stepGoalPoints: 0,
          weightLossPoints: 0,
          stepGoalDaysAchieved: 0
        });
        
        await newParticipant.save();
        actions.push(`Created participant record for "${challenge.name}"`);
      }
    }
    
    // Final status
    const finalParticipants = await ChallengeParticipant.find({ userId: user.googleId });
    const finalChallenges = await Challenge.find({ participants: user.email });
    
    console.log(`✅ Fixed ${userEmail}: ${finalParticipants.length} participant records, ${finalChallenges.length} challenges`);
    
    res.json({
      message: `Successfully fixed stuck user ${userEmail}`,
      user: user.name,
      actions: actions,
      finalParticipants: finalParticipants.length,
      finalChallenges: finalChallenges.length,
      consistent: finalParticipants.length === finalChallenges.length
    });
    
  } catch (error) {
    console.error('❌ Error fixing stuck user:', error);
    res.status(500).json({ error: 'Failed to fix stuck user', details: error.message });
  }
});

// Comprehensive endpoint to check and fix dbop1414's challenge memberships
// Robust step point checking service - can be called frequently
app.post('/api/sync-step-points', authenticateJWT, async (req, res) => {
  try {
    const { userId, forceSync } = req.body;
    
    console.log(`🔄 Starting step point sync for user: ${userId || 'ALL USERS'}`);
    
    let results = [];
    let usersToCheck = [];
    
    if (userId) {
      // Sync specific user
      const user = await User.findOne({ 
        $or: [
          { googleId: userId },
          { email: userId }
        ]
      });
      
      if (user) {
        usersToCheck = [user];
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      // Sync all users with active challenges
      const activeParticipants = await ChallengeParticipant.find({}).populate('challengeId');
      const uniqueUserIds = [...new Set(activeParticipants.map(p => p.userId))];
      
      usersToCheck = await User.find({ googleId: { $in: uniqueUserIds } });
      console.log(`📊 Found ${usersToCheck.length} users with active challenges`);
    }
    
    for (const user of usersToCheck) {
      try {
        console.log(`🎯 Checking step points for ${user.email} (${user.googleId})`);
        
        // Get user's current challenges
        const userParticipations = await ChallengeParticipant.find({ userId: user.googleId });
        
        if (userParticipations.length === 0) {
          console.log(`⚠️ No active challenges for ${user.email}`);
          continue;
        }
        
        let userResult = {
          userId: user.googleId,
          email: user.email,
          name: user.name,
          steps: user.steps || 0,
          challenges: [],
          pointsEarned: 0,
          lastSync: new Date()
        };
        
        // Check each challenge for step goal achievement
        // Filter out orphaned records (challenges that no longer exist)
        const validParticipations = [];
        for (const participation of userParticipations) {
          const challenge = await Challenge.findById(participation.challengeId);
          
          if (!challenge) {
            console.log(`⚠️ Challenge ${participation.challengeId} not found for ${user.email} - removing orphaned participant record`);
            // Delete orphaned participant record
            await ChallengeParticipant.findByIdAndDelete(participation._id);
            console.log(`🗑️ Deleted orphaned participant record for challenge ${participation.challengeId}`);
            continue;
          }
          
          // Store challenge with participation for later use
          validParticipations.push({ participation, challenge });
        }
        
        // Process only valid participations
        for (const { participation, challenge } of validParticipations) {
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Initialize missing fields
          if (participation.stepGoalPoints === undefined) {
            participation.stepGoalPoints = 0;
          }
          if (participation.weightLossPoints === undefined) {
            participation.weightLossPoints = 0;
          }
          if (participation.stepGoalDaysAchieved === undefined) {
            participation.stepGoalDaysAchieved = 0;
          }
          
          // Check if a new calendar day has started since last step point
          const now = new Date();
          const lastStepPointTime = participation.lastStepPointTimestamp ? new Date(participation.lastStepPointTimestamp) : null;
          const canEarnPoint = has24HoursPassed(lastStepPointTime);
          
          // Update step count regardless
          const oldStepCount = participation.lastStepCount || 0;
          participation.lastStepCount = user.steps || 0;
          
          const stepGoalNum = getStepGoal(challenge);
          const stepGoalMet = (user.steps || 0) >= stepGoalNum;
          
          let challengeResult = {
            challengeId: challenge._id.toString(),
            challengeName: challenge.name,
            stepGoal: stepGoalNum,
            currentSteps: user.steps || 0,
            stepGoalMet: stepGoalMet,
            alreadyGotPointWithin24Hours: !canEarnPoint,
            pointEarned: false,
            oldPoints: participation.points,
            newPoints: participation.points
          };
          
          // Award step goal point if eligible (goal met AND new calendar day)
          if (canEarnPoint && stepGoalMet) {
            // Initialize fields if needed
            if (!participation.stepGoalPoints) participation.stepGoalPoints = 0;
            if (!participation.stepGoalDaysAchieved) participation.stepGoalDaysAchieved = 0;
            
            // Award the point
            participation.stepGoalPoints += 1;
            participation.stepGoalDaysAchieved += 1;
            participation.lastStepPointTimestamp = now;
            participation.lastStepDate = new Date(now);
            
            // Update total points: step points + weight loss points (always included)
            const stepPoints = participation.stepGoalPoints;
            const weightLossPoints = participation.weightLossPoints || 0;
            participation.points = stepPoints + weightLossPoints;
            
            challengeResult.pointEarned = true;
            challengeResult.newPoints = participation.points;
            userResult.pointsEarned += 1;
            
            console.log(`🏆 ${user.email} earned step goal point in "${challenge.name}" (${user.steps} >= ${stepGoalNum})`);
          } else if (!canEarnPoint && stepGoalMet) {
            console.log(`✅ ${user.email} already got step point today for "${challenge.name}"`);
            // Still update total points to ensure consistency
            const stepPoints = participation.stepGoalPoints || 0;
            const weightLossPoints = participation.weightLossPoints || 0;
            participation.points = stepPoints + weightLossPoints;
          } else {
            console.log(`📊 ${user.email} hasn't reached step goal for "${challenge.name}" (${user.steps}/${stepGoalNum}) - Goal NOT met, no point awarded`);
          }
          
          // Ensure total points are correct even if no new point was earned
          const stepPoints = participation.stepGoalPoints || 0;
          const weightLossPoints = participation.weightLossPoints || 0;
          participation.points = stepPoints + weightLossPoints;
          
          // Save the participant record
          await participation.save();
          
          userResult.challenges.push(challengeResult);
        }
        
        results.push(userResult);
        
      } catch (error) {
        console.error(`❌ Error processing ${user.email}:`, error);
        results.push({
          userId: user.googleId,
          email: user.email,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Step point sync completed. Processed ${results.length} users`);
    
    res.json({
      message: `Step point sync completed for ${results.length} user(s)`,
      results: results,
      summary: {
        totalUsers: results.length,
        usersWithPoints: results.filter(r => r.pointsEarned > 0).length,
        totalPointsAwarded: results.reduce((sum, r) => sum + (r.pointsEarned || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('❌ Step point sync error:', error);
    res.status(500).json({ error: 'Step point sync failed', details: error.message });
  }
});

// Admin endpoint to manually add step point for today
app.post('/api/admin/add-today-step-point', async (req, res) => {
  try {
    const { userEmail, challengeId } = req.body;
    
    if (!userEmail || !challengeId) {
      return res.status(400).json({ error: 'userEmail and challengeId are required' });
    }
    
    console.log(`🎯 Adding today's step point for ${userEmail} in challenge ${challengeId}`);
    
    // Find the user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the challenge
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    // Find participant record
    const participant = await ChallengeParticipant.findOne({
      challengeId: challengeId,
      userId: user.googleId
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant record not found' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if already got point today
    let alreadyGotStepPoint = false;
    if (participant.lastStepDate) {
      const lastStepDateOnly = new Date(participant.lastStepDate);
      lastStepDateOnly.setHours(0, 0, 0, 0);
      alreadyGotStepPoint = lastStepDateOnly.getTime() === today.getTime();
    }
    
    if (alreadyGotStepPoint) {
      return res.json({ 
        message: 'User already has step point for today',
        participant: {
          points: participant.points,
          stepGoalPoints: participant.stepGoalPoints,
          lastStepDate: participant.lastStepDate
        }
      });
    }
    
    // Initialize missing fields
    if (participant.stepGoalPoints === undefined) {
      participant.stepGoalPoints = 0;
    }
    if (participant.stepGoalDaysAchieved === undefined) {
      participant.stepGoalDaysAchieved = 0;
    }
    
    // Add the point
    const oldPoints = participant.points;
    participant.points += 1;
    participant.stepGoalPoints += 1;
    participant.stepGoalDaysAchieved += 1;
    participant.lastStepDate = today;
    
    await participant.save();
    
    console.log(`✅ Added step point for ${userEmail}: ${oldPoints} -> ${participant.points}`);
    
    res.json({
      message: 'Step point added successfully',
      participant: {
        oldPoints: oldPoints,
        newPoints: participant.points,
        stepGoalPoints: participant.stepGoalPoints,
        stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
        lastStepDate: participant.lastStepDate
      }
    });
    
  } catch (error) {
    console.error('❌ Error adding step point:', error);
    res.status(500).json({ error: 'Failed to add step point', details: error.message });
  }
});

app.post('/api/admin/fix-session-contamination', async (req, res) => {
  try {
    const dbop1414Email = 'dbop1414@gmail.com';
    
    console.log(`🔧 Comprehensive fix for ${dbop1414Email} challenge memberships`);
    
    // Find dbop1414
    const dbop1414 = await User.findOne({ email: dbop1414Email });
    
    if (!dbop1414) {
      return res.status(404).json({ error: `User ${dbop1414Email} not found` });
    }
    
    console.log(`✅ Found user: ${dbop1414.name} (${dbop1414.googleId})`);
    
    let actions = [];
    
    // Get all challenges dbop1414 appears in
    const challengesWithUser = await Challenge.find({ participants: dbop1414Email });
    const participantRecords = await ChallengeParticipant.find({ userId: dbop1414.googleId });
    
    console.log(`📊 dbop1414 appears in ${challengesWithUser.length} challenge(s) and has ${participantRecords.length} participant record(s)`);
    
    // Check each challenge dbop1414 is in
    for (const challenge of challengesWithUser) {
      console.log(`🔍 Checking challenge "${challenge.name}" (${challenge._id})`);
      console.log(`  - Admin: ${challenge.admin}`);
      console.log(`  - Created by: ${challenge.creatorEmail || 'Unknown'}`);
      console.log(`  - Participants: ${challenge.participants.join(', ')}`);
      
      // Check if dbop1414 should legitimately be in this challenge
      const isAdmin = challenge.admin === dbop1414.googleId;
      const isCreator = challenge.creatorEmail === dbop1414Email;
      
      if (!isAdmin && !isCreator) {
        console.log(`🚨 dbop1414 shouldn't be in "${challenge.name}" - removing`);
        
        // Remove from participants array
        challenge.participants = challenge.participants.filter(email => email !== dbop1414Email);
        await challenge.save();
        actions.push(`Removed ${dbop1414Email} from "${challenge.name}" participants array`);
        console.log(`✅ Removed from participants array`);
        
        // Find and remove participant record
        const participantRecord = await ChallengeParticipant.findOne({ 
          challengeId: challenge._id, 
          userId: dbop1414.googleId 
        });
        
        if (participantRecord) {
          await ChallengeParticipant.findByIdAndDelete(participantRecord._id);
          actions.push(`Deleted participant record from "${challenge.name}" (had ${participantRecord.points} points)`);
          console.log(`✅ Deleted participant record`);
        }
      } else {
        console.log(`✅ dbop1414 legitimately belongs in "${challenge.name}" (admin: ${isAdmin}, creator: ${isCreator})`);
      }
    }
    
    // Check for orphaned participant records
    for (const participant of participantRecords) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        console.log(`🗑️ Found orphaned participant record for deleted challenge ${participant.challengeId}`);
        await ChallengeParticipant.findByIdAndDelete(participant._id);
        actions.push(`Deleted orphaned participant record for challenge ${participant.challengeId}`);
      } else if (!challenge.participants.includes(dbop1414Email)) {
        console.log(`🔧 Found participant record but user not in challenge participants array for "${challenge.name}"`);
        // This was already handled above if the user shouldn't be in the challenge
      }
    }
    
    if (actions.length === 0) {
      return res.json({ 
        message: 'No issues found - dbop1414 is properly in their legitimate challenges only',
        challengesChecked: challengesWithUser.length
      });
    }
    
    console.log(`✅ Fixed ${actions.length} issue(s) with dbop1414's challenge memberships`);
    
    res.json({
      message: `Successfully cleaned up ${dbop1414Email}'s challenge memberships`,
      actions: actions,
      challengesChecked: challengesWithUser.length
    });
    
  } catch (error) {
    console.error('❌ Error fixing challenge memberships:', error);
    res.status(500).json({ error: 'Failed to fix challenge memberships', details: error.message });
  }
});

// Emergency endpoint to force remove dbop1414 from "test Leaderboard" challenge
app.post('/api/admin/force-remove-from-test-leaderboard', async (req, res) => {
  try {
    const userEmail = 'dbop1414@gmail.com';
    
    console.log(`🚨 Force removing ${userEmail} from "test Leaderboard" challenge`);
    
    // Find the user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: `User ${userEmail} not found` });
    }
    
    // Find the "test Leaderboard" challenge (case insensitive)
    const challenge = await Challenge.findOne({ 
      name: { $regex: /test.*leaderboard/i } 
    });
    
    if (!challenge) {
      return res.json({ message: 'No "test Leaderboard" challenge found - user already clean' });
    }
    
    console.log(`🎯 Found challenge: "${challenge.name}" (${challenge._id})`);
    
    let actions = [];
    
    // Remove from participants array
    if (challenge.participants.includes(user.email)) {
      challenge.participants = challenge.participants.filter(email => email !== user.email);
      await challenge.save();
      actions.push(`Removed ${user.email} from challenge participants array`);
      console.log(`✅ Removed from participants array`);
    }
    
    // Remove participant record
    const participantRecord = await ChallengeParticipant.findOne({ 
      challengeId: challenge._id, 
      userId: user.googleId 
    });
    
    if (participantRecord) {
      await ChallengeParticipant.findByIdAndDelete(participantRecord._id);
      actions.push(`Deleted ChallengeParticipant record (had ${participantRecord.points} points)`);
      console.log(`✅ Deleted participant record`);
    }
    
    console.log(`✅ Force removal completed`);
    
    res.json({
      message: `Successfully force-removed ${userEmail} from "${challenge.name}"`,
      challengeName: challenge.name,
      challengeId: challenge._id.toString(),
      actions: actions
    });
    
  } catch (error) {
    console.error('❌ Error force removing user:', error);
    res.status(500).json({ error: 'Failed to force remove user', details: error.message });
  }
});

// Mount auth routes FIRST to ensure they're registered before other /api routes
app.use('/api', authRoutes); // OAuth2 routes (must be before /api/auth/token to avoid conflicts)
app.use('/api/user', authenticateJWT, userRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/realtime', realtimeRoutes.router);

// Admin endpoint to delete ALL challenges (use with caution!)
app.delete('/api/admin/delete-all-challenges', async (req, res) => {
  try {
    console.log('🗑️ ADMIN: Deleting ALL challenges and related data...');
    
    // Get all challenges first to log them
    const allChallenges = await Challenge.find({});
    console.log(`📊 Found ${allChallenges.length} challenge(s) to delete`);
    
    // Get all challenge IDs
    const challengeIds = allChallenges.map(c => c._id.toString());
    
    // Delete all participants
    const deletedParticipants = await ChallengeParticipant.deleteMany({});
    console.log(`🗑️ Deleted ${deletedParticipants.deletedCount} participant record(s)`);
    
    // Delete all chat messages
    const ChatMessage = require('./models/ChatMessage');
    const deletedMessages = await ChatMessage.deleteMany({});
    console.log(`🗑️ Deleted ${deletedMessages.deletedCount} chat message(s)`);
    
    // Delete all challenges
    const deletedChallenges = await Challenge.deleteMany({});
    console.log(`🗑️ Deleted ${deletedChallenges.deletedCount} challenge(s)`);
    
    // Note: Matrix rooms are not deleted here as they require Matrix client connection
    // They can be cleaned up separately if needed
    
    res.json({
      success: true,
      message: 'All challenges and related data deleted successfully',
      deleted: {
        challenges: deletedChallenges.deletedCount,
        participants: deletedParticipants.deletedCount,
        chatMessages: deletedMessages.deletedCount
      }
    });
    
    console.log('✅ ADMIN: All challenges deleted successfully');
  } catch (error) {
    console.error('❌ ADMIN: Error deleting all challenges:', error);
    res.status(500).json({ 
      error: 'Failed to delete all challenges', 
      details: error.message 
    });
  }
});

// Admin endpoint to fix date of existing manual weight entry
// Accepts: { userId, oldDate (YYYY-MM-DD), newDate (YYYY-MM-DD) }
app.post('/api/admin/fix-weight-date', async (req, res) => {
  try {
    const userId = req.body.userId || '105044462574652357380';
    const oldDateStr = req.body.oldDate || '2026-01-04';
    const newDateStr = req.body.newDate || '2026-01-03';
    
    const FitnessHistory = require('./models/FitnessHistory');
    const oldDate = FitnessHistory.normalizeDate(new Date(oldDateStr + 'T00:00:00'));
    const newDate = FitnessHistory.normalizeDate(new Date(newDateStr + 'T00:00:00'));
    
    // Find the entry with the old date
    const oldEntry = await FitnessHistory.findOne({
      userId: userId,
      date: oldDate,
      source: 'manual'
    });
    
    if (!oldEntry) {
      return res.status(404).json({ error: `No manual entry found for ${oldDateStr}` });
    }
    
    // Check if there's already an entry for the new date
    const existingNewEntry = await FitnessHistory.findOne({
      userId: userId,
      date: newDate
    });
    
    if (existingNewEntry && existingNewEntry.source === 'manual') {
      // Update the existing entry with the weight from the old entry
      existingNewEntry.weight = oldEntry.weight;
      existingNewEntry.source = 'manual';
      existingNewEntry.updatedAt = new Date();
      await existingNewEntry.save();
      
      // Delete the old entry
      await FitnessHistory.deleteOne({ _id: oldEntry._id });
      
      return res.json({ 
        success: true, 
        message: `Updated entry for ${newDateStr} with weight ${oldEntry.weight} lbs and deleted entry for ${oldDateStr}`,
        newEntry: existingNewEntry
      });
    } else {
      // Create new entry with the new date, or update existing non-manual entry
      const newEntry = await FitnessHistory.findOneAndUpdate(
        { userId: userId, date: newDate },
        {
          $set: {
            weight: oldEntry.weight,
            source: 'manual',
            updatedAt: new Date()
          },
          $setOnInsert: {
            steps: existingNewEntry?.steps || 0,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      // Delete the old entry
      await FitnessHistory.deleteOne({ _id: oldEntry._id });
      
      return res.json({ 
        success: true, 
        message: `Moved entry from ${oldDateStr} to ${newDateStr} with weight ${oldEntry.weight} lbs`,
        newEntry: newEntry
      });
    }
  } catch (err) {
    console.error('Error fixing weight date:', err);
    res.status(500).json({ error: 'Failed to fix weight date', details: err.message });
  }
});

// Admin endpoint to add historical weight entry
// Accepts: { userId, weight, date (ISO string) } or uses defaults for dbop14
app.post('/api/admin/add-historical-weight', async (req, res) => {
  try {
    // Allow parameters from request body, or use defaults for dbop14
    const userId = req.body.userId || '105044462574652357380'; // dbop14's Google ID (default)
    const weight = req.body.weight !== undefined ? req.body.weight : 194.6;
    const dateString = req.body.date || '2025-12-12T12:08:00';
    const date = new Date(dateString);
    
    // Get user info for logging
    const user = await User.findOne({ googleId: userId });
    const userName = user?.name || user?.email || userId;
    
    const dateStr = date.toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    console.log(`📊 [HISTORICAL WEIGHT LOG] On ${dateStr}, ${userName} logged a weight of ${weight} lbs`);
    console.log(`📊 Adding historical weight entry for ${userName} (${userId}): ${weight} lbs on ${date.toISOString()}`);
    
    // Normalize date to start of day for FitnessHistory
    const normalizedDate = FitnessHistory.normalizeDate(date);
    
    // Add to FitnessHistory
    const historyEntry = await FitnessHistory.findOneAndUpdate(
      { userId: userId, date: normalizedDate },
      {
        $set: {
          weight: weight,
          source: 'manual',
          updatedAt: date
        },
        $setOnInsert: {
          steps: 0,
          createdAt: date
        }
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Added FitnessHistory entry for ${date.toISOString()}: ${historyEntry.weight} lbs`);
    
    // Update all ChallengeParticipant records for this user to use 194.6 as lastWeight
    const participants = await ChallengeParticipant.find({ userId: userId });
    
    for (const participant of participants) {
      const oldWeight = participant.lastWeight;
      participant.lastWeight = weight;
      
      // Recalculate weight loss points if starting weight exists
      if (participant.startingWeight) {
        const totalWeightLost = participant.startingWeight - weight;
        const totalPercentLost = Math.max(0, (totalWeightLost / participant.startingWeight) * 100);
        participant.weightLossPoints = roundWeightLossPoints(totalPercentLost);
        
        // Recalculate total points
        const stepPoints = participant.stepGoalPoints || 0;
        participant.points = stepPoints + participant.weightLossPoints;
      }
      
      await participant.save();
      console.log(`✅ Updated ChallengeParticipant lastWeight: ${oldWeight} → ${weight} lbs (challenge: ${participant.challengeId})`);
    }
    
    // Also update User model (user already fetched above)
    if (user) {
      const oldUserWeight = user.weight;
      user.weight = weight;
      await user.save();
      console.log(`✅ Updated User model weight: ${oldUserWeight} → ${weight} lbs`);
    }
    
    console.log(`✅ [HISTORICAL WEIGHT LOG COMPLETE] Successfully logged weight of ${weight} lbs for ${userName} on ${dateStr}`);
    
    res.json({
      success: true,
      message: `Successfully added historical weight entry: ${weight} lbs on ${date.toISOString()}`,
      logMessage: `On ${dateStr}, ${userName} logged a weight of ${weight} lbs`,
      userId: userId,
      userName: userName,
      weight: weight,
      date: date.toISOString(),
      formattedDate: dateStr,
      participantsUpdated: participants.length
    });
  } catch (error) {
    console.error('❌ Error adding historical weight:', error);
    res.status(500).json({ error: 'Failed to add historical weight', details: error.message });
  }
});

// Admin endpoint to update starting weight for a participant
app.post('/api/admin/update-starting-weight', async (req, res) => {
  try {
    const { userId, challengeId, startingWeight } = req.body;
    
    if (!userId || !challengeId || startingWeight === undefined) {
      return res.status(400).json({ error: 'Missing required fields: userId, challengeId, and startingWeight are required' });
    }
    
    const weightValue = parseFloat(startingWeight);
    if (isNaN(weightValue) || weightValue <= 0) {
      return res.status(400).json({ error: 'Invalid starting weight: must be a positive number' });
    }
    
    console.log(`📊 Updating starting weight for user ${userId} in challenge ${challengeId} to ${weightValue} lbs`);
    
    // Find the participant
    const participant = await ChallengeParticipant.findOne({
      challengeId: challengeId,
      userId: userId
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in this challenge' });
    }
    
    const oldStartingWeight = participant.startingWeight;
    participant.startingWeight = weightValue;
    
    // If lastWeight is not set or is the same as old starting weight, update it to new starting weight
    if (!participant.lastWeight || participant.lastWeight === oldStartingWeight) {
      participant.lastWeight = weightValue;
    }
    
    // Recalculate weight loss points
    if (participant.lastWeight) {
      const totalWeightLost = weightValue - participant.lastWeight;
      const totalPercentLost = Math.max(0, (totalWeightLost / weightValue) * 100);
      participant.weightLossPoints = roundWeightLossPoints(totalPercentLost);
      
      // Recalculate total points
      const stepPoints = participant.stepGoalPoints || 0;
      participant.points = stepPoints + participant.weightLossPoints;
    }
    
    await participant.save();
    
    console.log(`✅ Updated starting weight: ${oldStartingWeight} → ${weightValue} lbs for user ${userId} in challenge ${challengeId}`);
    
    res.json({
      success: true,
      message: `Successfully updated starting weight to ${weightValue} lbs`,
      participant: {
        userId: participant.userId,
        startingWeight: participant.startingWeight,
        lastWeight: participant.lastWeight,
        weightLossPoints: participant.weightLossPoints,
        totalPoints: participant.points
      }
    });
  } catch (error) {
    console.error('❌ Error updating starting weight:', error);
    res.status(500).json({ error: 'Failed to update starting weight', details: error.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'FitApp Backend API',
    status: 'running',
    version: '1.0.0'
  });
});

// Favicon route - return 204 No Content (standard for missing favicon)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 404 handler for unmatched routes
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  console.log(`   Headers:`, {
    host: req.headers.host,
    'user-agent': req.headers['user-agent'],
    authorization: req.headers.authorization ? 'Present' : 'Missing'
  });
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening at http://0.0.0.0:${PORT}`)
  console.log(`✅ CORS configured for: https://fitapp.herringm.com, https://fitappbackend.herringm.com`)
  console.log(`✅ Health check available at: http://0.0.0.0:${PORT}/api/health`)
  console.log(`✅ Nodemon is running - changes will auto-reload`)
  console.log(`✅ Registered routes:`)
  console.log(`   - GET/POST /api/user/userdata`)
  console.log(`   - GET /api/health`)
})

