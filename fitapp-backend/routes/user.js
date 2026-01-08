const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const FitnessHistory = require('../models/FitnessHistory');
const { google } = require('googleapis');
const { broadcastUserUpdate } = require('./realtime');
const { ensureValidGoogleTokens } = require('../utils/googleAuth');

// POST /api/user/userdata - upsert user fitness data
router.post('/userdata', async (req, res) => {
  const { googleId, name, email, picture, steps, weight, challengeIds, date } = req.body;
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId' });
  }
  
  console.log(`📥 POST /api/user/userdata received:`, { googleId, email, steps, weight, date, hasDate: !!date });
  
  // debug instrumentation removed
  
  try {
    // Check if user already exists to preserve custom profile picture
    const existingUser = await User.findOne({ googleId });
    
    // Store historical data - use provided date or default to today
    const targetDate = date ? FitnessHistory.normalizeDate(new Date(date)) : FitnessHistory.normalizeDate(new Date());
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Check if this is today's data or historical data
    const today = FitnessHistory.normalizeDate(new Date());
    const isToday = targetDate.getTime() === today.getTime();
    
    // debug instrumentation removed
    
    // Only update user's current steps/weight if this is today's data
    // Historical data should only update FitnessHistory, not the user's current state
    const updateFields = {
      name,
      email,
      lastSync: new Date()
    };
    
    // Only update picture if:
    // 1. User doesn't exist (new user), OR
    // 2. User exists but has no picture, OR
    // 3. User's current picture is NOT a custom picture (data URL)
    // Custom pictures start with "data:image" and should never be overwritten by Google
    const isCustomPicture = existingUser?.picture && existingUser.picture.startsWith('data:image');
    if (!existingUser || !existingUser.picture || !isCustomPicture) {
      updateFields.picture = picture;
    }
    // Otherwise, preserve the existing custom picture (data URL)
    
    if (isToday) {
      // For today's data, update user's current steps and weight
      updateFields.steps = steps;
      updateFields.weight = weight;
      console.log(`🔄 Updating user's current data for ${email}: steps=${steps}, weight=${weight}`);
      // debug instrumentation removed
    } else {
      // For historical data, preserve existing user steps/weight (don't overwrite with historical values)
      console.log(`📅 Historical data for ${email} on ${dateStr}: steps=${steps}, weight=${weight} - NOT updating user's current state`);
      // debug instrumentation removed
    }
    
    const user = await User.findOneAndUpdate(
      { googleId },
      { $set: updateFields },
      { upsert: true, new: true }
    );
    
    // debug instrumentation removed

    if (isToday) {
      console.log(`🔄 Updated user data for ${email}: steps=${steps}, weight=${weight}`);
    }
    
    console.log(`📊 Storing fitness history for ${email} on ${dateStr}: steps=${steps}, weight=${weight}`);
    
    await FitnessHistory.findOneAndUpdate(
      { userId: googleId, date: targetDate },
      {
        $set: {
          steps: steps || 0,
          weight: weight || null,
          source: 'sync',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`✅ Stored fitness history for ${email} on ${dateStr}: steps=${steps}, weight=${weight || 'null'}`);

    let pointsUpdates = [];
    
    // If no challengeIds provided, find all challenges where user is a participant
    let challengesToProcess = [];
    if (Array.isArray(challengeIds) && challengeIds.length > 0) {
      challengesToProcess = challengeIds;
    } else {
      // Find all challenges where this user is a participant
      const userParticipations = await ChallengeParticipant.find({ userId: googleId });
      
      // Filter out orphaned records (challenges that no longer exist)
      const validChallengeIds = [];
      for (const participation of userParticipations) {
        const challenge = await Challenge.findById(participation.challengeId);
        if (!challenge) {
          console.log(`⚠️ Challenge ${participation.challengeId} not found for ${email} - removing orphaned participant record`);
          // Delete orphaned participant record
          await ChallengeParticipant.findByIdAndDelete(participation._id);
          console.log(`🗑️ Deleted orphaned participant record for challenge ${participation.challengeId}`);
          continue;
        }
        validChallengeIds.push(participation.challengeId);
      }
      
      challengesToProcess = validChallengeIds;
      console.log(`🔍 Found ${challengesToProcess.length} valid challenges for user ${email}`);
    }

    for (const challengeId of challengesToProcess) {
      const challenge = await Challenge.findById(challengeId);
      if (!challenge) {
        console.log(`⚠️ Challenge ${challengeId} not found`);
        continue;
      }
      
      // Find or create ChallengeParticipant using googleId
      let participant = await ChallengeParticipant.findOne({ challengeId, userId: googleId });
      if (!participant) {
        console.log(`⚠️ No participant record found for user ${email} in challenge ${challengeId}`);
        continue;
      }

      let pointsEarned = 0;
      
      // Helper functions for point calculation (same as in index.js)
      const roundWeightLossPoints = (percentage) => {
        const decimal = percentage % 1;
        if (decimal >= 0.5) {
          return Math.ceil(percentage);
        } else {
          return Math.floor(percentage);
        }
      };
      
      const has24HoursPassed = (timestamp) => {
        if (!timestamp) return true;
        const now = new Date();
        const timeDiff = now.getTime() - timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff >= 24;
      };
      
      // Weight loss points - calculate continuously throughout the challenge
      // Use last recorded weight if current weight is not available (users don't need to weigh in daily)
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
          } else if (weight !== undefined && weight !== null && weight > 0) {
            // Fallback to current weight if no history
            participant.lastWeight = weight;
          }
        }
        
        // Use lastWeight for calculation (don't use weight parameter as it may be stale)
        const currentWeight = participant.lastWeight;
        
        if (currentWeight !== undefined && currentWeight !== null) {
          // Calculate weight loss points continuously
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
              console.log(`🏆 Weight loss points updated: +${pointsDifference} (${totalPercentLost.toFixed(2)}% lost)`);
            }
            console.log(`📊 Total points: ${stepPoints} step points + ${expectedWeightLossPoints} weight loss = ${participant.points} total`);
          } else {
            // Weight loss points unchanged, but ensure total points are correct
            const stepPoints = participant.stepGoalPoints || 0;
            participant.points = stepPoints + expectedWeightLossPoints;
          }
        }
      }
      
      // Step goal points (once per 24-hour period)
      // IMPORTANT: Only calculate step points for today's data, not historical days
      // Historical days should only update FitnessHistory, not trigger point calculations
      if (steps !== undefined && isToday) {
        // Ensure steps is a number (handle string conversion)
        const stepsNum = typeof steps === 'string' ? parseInt(steps, 10) : Number(steps);
        const stepGoalNum = typeof challenge.stepGoal === 'string' ? parseInt(challenge.stepGoal, 10) : Number(challenge.stepGoal);
        
        const now = new Date();
        const lastStepPointTime = participant.lastStepPointTimestamp ? new Date(participant.lastStepPointTimestamp) : null;
        const canEarnPoint = has24HoursPassed(lastStepPointTime);
        
        console.log(`🔍 Step goal check for ${email}:`, {
          steps: stepsNum,
          stepGoal: stepGoalNum,
          reachedGoal: stepsNum >= stepGoalNum,
          lastStepPointTime: lastStepPointTime?.toISOString(),
          canEarnPoint,
          hoursSinceLastPoint: lastStepPointTime ? ((now.getTime() - lastStepPointTime.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A',
          currentStepPoints: participant.stepGoalPoints || 0
        });
        
        // Update step count regardless of goal achievement
        participant.lastStepCount = stepsNum;
        
        // Award point immediately when goal is reached (if 24 hours have passed)
        // IMPORTANT: Must meet or exceed the goal (steps >= challenge.stepGoal)
        if (canEarnPoint && stepsNum >= stepGoalNum) {
          // Initialize fields if needed
          if (!participant.stepGoalPoints) participant.stepGoalPoints = 0;
          if (!participant.stepGoalDaysAchieved) participant.stepGoalDaysAchieved = 0;
          
          // Award the point
          participant.stepGoalPoints += 1;
          participant.stepGoalDaysAchieved += 1;
          participant.lastStepPointTimestamp = now;
          participant.lastStepDate = new Date(now);
          
          // Update total points: step points + weight loss points (always included)
          const stepPoints = participant.stepGoalPoints;
          const weightLossPoints = participant.weightLossPoints || 0;
          participant.points = stepPoints + weightLossPoints;
          
          pointsEarned += 1;
          console.log(`🏆 Step goal achieved! +1 point (${stepsNum.toLocaleString()} steps >= ${stepGoalNum.toLocaleString()} goal)`);
          console.log(`📊 Updated: ${participant.stepGoalPoints} step points, ${participant.stepGoalDaysAchieved} days achieved`);
          console.log(`📊 Total points: ${participant.points} (${stepPoints} step + ${weightLossPoints} weight loss)`);
        } else if (!canEarnPoint && stepsNum >= stepGoalNum) {
          const hoursRemaining = 24 - ((now.getTime() - lastStepPointTime.getTime()) / (1000 * 60 * 60));
          console.log(`✅ Step goal met but point already awarded within 24 hours (${hoursRemaining.toFixed(1)} hours remaining until next point eligible)`);
          // Still update total points to ensure consistency
          const stepPoints = participant.stepGoalPoints || 0;
          const weightLossPoints = participant.weightLossPoints || 0;
          participant.points = stepPoints + weightLossPoints;
        } else if (stepsNum < stepGoalNum) {
          const remaining = stepGoalNum - stepsNum;
          console.log(`📊 Step progress: ${stepsNum.toLocaleString()}/${stepGoalNum.toLocaleString()} (${remaining.toLocaleString()} remaining) - Goal NOT met, no point awarded`);
          // Ensure points are correct even when goal not met
          const stepPoints = participant.stepGoalPoints || 0;
          const weightLossPoints = participant.weightLossPoints || 0;
          participant.points = stepPoints + weightLossPoints;
        }
      }
      
      // Save participant data with updated points
      await participant.save();
      pointsUpdates.push({ challengeId, points: participant.points, pointsEarned });
    }
    
    console.log(`📊 Points updates for ${email}:`, pointsUpdates);
    
    // Broadcast update via SSE - only for today's data to prevent historical values from overwriting current state
    if (isToday) {
      broadcastUserUpdate(googleId, {
        steps: user.steps,
        weight: user.weight,
        lastSync: user.lastSync
      });
    } else {
      console.log(`📅 Skipping SSE broadcast for historical data on ${dateStr} - preserving current user state`);
    }
    
    res.json({ user, pointsUpdates });
  } catch (err) {
    console.error('Points logic error:', err);
    res.status(500).json({ error: 'Failed to upsert user data or calculate points', details: err.message });
  }
});

// GET /api/user/userdata?googleId=... - get stored user data, optionally sync from Google Fit
router.get('/userdata', async (req, res) => {
  console.log(`📥 GET /api/user/userdata - googleId: ${req.query.googleId}`);
  const { googleId } = req.query;
  if (!googleId) return res.status(400).json({ error: 'Missing googleId' });
  try {
    const user = await User.findOne({ googleId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If user has no access token, just return stored data
    if (!user.accessToken) {
      console.log(`📊 Returning stored data for ${user.email} (no access token available)`);
      return res.json({ 
        steps: user.steps || 0, 
        weight: user.weight || null, 
        lastSync: user.lastSync || null,
        name: user.name || null,
        picture: user.picture || null
      });
    }

    // Ensure tokens are valid and refresh proactively if needed
    let oauth2Client;
    try {
      const tokenResult = await ensureValidGoogleTokens(user);
      oauth2Client = tokenResult.oauth2Client;
      if (tokenResult.refreshed) {
        console.log(`🔑 Token refreshed proactively for ${user.email}`);
      }
    } catch (tokenError) {
      console.error('❌ Token validation/refresh failed:', tokenError);
      // If token refresh fails, return stored data instead of error
      return res.json({ 
        steps: user.steps || 0, 
        weight: user.weight || null, 
        lastSync: user.lastSync || null,
        name: user.name || null,
        picture: user.picture || null,
        error: 'Token refresh failed, returning stored data'
      });
    }

    // Fetch Google Fit data - query last 7 days to get most recent weight (not just today's)
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7); // Query last 7 days to get most recent weight
    start.setHours(0, 0, 0, 0);
    const end = now;
    
    // Get the current access token (may have been refreshed)
    const credentials = await oauth2Client.getAccessToken();
    const accessToken = credentials.token || user.accessToken;
    
    const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.weight' }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // Daily buckets
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      }),
    });
    const data = await response.json();
    
    // Store historical data for each day in the response
    if (data.bucket && data.bucket.length > 0) {
      for (const bucket of data.bucket) {
        // Google Fit returns startTimeMillisNanos (nanoseconds) - convert to milliseconds
        const bucketStartMillis = bucket.startTimeMillisNanos ? 
          parseInt(bucket.startTimeMillisNanos) / 1000000 : 
          bucket.startTimeMillis;
        const bucketDate = FitnessHistory.normalizeDate(new Date(bucketStartMillis));
        
        const stepsData = bucket.dataset?.find(d => d.dataTypeName === 'com.google.step_count.delta');
        const weightData = bucket.dataset?.find(d => d.dataTypeName === 'com.google.weight');
        
        const steps = stepsData?.point?.[0]?.value?.[0]?.intVal ?? 0;
        const weightKg = weightData?.point?.[0]?.value?.[0]?.fpVal ?? null;
        const weight = weightKg ? Math.round(weightKg * 2.20462 * 100) / 100 : null; // Convert kg to lbs
        
        // Store each day's data in history (only if we have data for that day)
        if (steps > 0 || weight !== null) {
          await FitnessHistory.findOneAndUpdate(
            { userId: googleId, date: bucketDate },
            {
              $set: {
                steps: steps || 0,
                weight: weight || null,
                source: 'google-fit',
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
        }
      }
      console.log(`📊 Stored ${data.bucket.length} days of fitness history for ${user.email}`);
    }
    
    // Get today's steps for user model update
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayBucket = data.bucket?.find(b => {
      const bucketStartMillis = b.startTimeMillisNanos ? 
        parseInt(b.startTimeMillisNanos) / 1000000 : 
        b.startTimeMillis;
      return bucketStartMillis >= todayStart.getTime();
    });
    const stepsData = todayBucket?.dataset?.find(d => d.dataTypeName === 'com.google.step_count.delta');
    const stepsFromGoogleFit = stepsData?.point?.[0]?.value?.[0]?.intVal ?? 0;
    
    // Get the MOST RECENT weight from the last 7 days (not just today's)
    let weight = null;
    if (data.bucket && data.bucket.length > 0) {
      // Find the most recent bucket with weight data (iterate backwards)
      for (let i = data.bucket.length - 1; i >= 0; i--) {
        const bucket = data.bucket[i];
        const weightData = bucket.dataset?.find(d => d.dataTypeName === 'com.google.weight');
        if (weightData && weightData.point && weightData.point.length > 0) {
          const weightKg = weightData.point[0]?.value?.[0]?.fpVal;
          if (weightKg && weightKg > 0) {
            weight = Math.round(weightKg * 2.20462 * 100) / 100; // Convert kg to lbs
            break; // Use the most recent weight found
          }
        }
      }
    }

    // CRITICAL FIX: Only update user's steps if Google Fit returns a valid (non-zero) step count
    // If Google Fit returns 0 or no data, preserve the existing user.steps value
    // This prevents overwriting correct step data with 0 when Google Fit API is incomplete
    const steps = stepsFromGoogleFit > 0 ? stepsFromGoogleFit : (user.steps || 0);

    // Preserve previous values so we can decide whether to broadcast later
    const previousSteps = user.steps;
    const previousWeight = user.weight;

    // Update user in DB
    user.steps = steps;
    // Only update user's weight if Google Fit returned a valid weight (non-null)
    if (weight !== null && weight !== undefined) {
      user.weight = weight;
    }
    user.lastSync = new Date();
    await user.save();

    // Store historical data for today - use stepsFromGoogleFit (not the preserved user.steps)
    // This ensures history reflects what Google Fit actually returned, even if it's 0
    const today = FitnessHistory.normalizeDate(new Date());
    await FitnessHistory.findOneAndUpdate(
      { userId: googleId, date: today },
      {
        $set: {
          steps: stepsFromGoogleFit || 0,
          // `weight` is already converted to lbs above when extracted from buckets,
          // so don't convert again — just store the value if present
          weight: (weight !== null && weight !== undefined) ? weight : null,
          source: 'google-fit',
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`📊 Stored Google Fit history for ${user.email} on ${today.toISOString()}: steps=${stepsFromGoogleFit}, weight=${(weight !== null && weight !== undefined) ? weight : null} (user.steps preserved as ${steps})`);

    // Broadcast update via SSE only if something actually changed to avoid UI bouncing
    const didStepsChange = user.steps !== previousSteps;
    const didWeightChange = user.weight !== previousWeight;
    if (didStepsChange || didWeightChange) {
      broadcastUserUpdate(user.googleId, {
        steps: user.steps,
        weight: user.weight,
        lastSync: user.lastSync
      });
    } else {
      // Still log that we skipped broadcast because nothing changed
      console.log(`📡 No user state change for ${user.email}; skipping SSE broadcast`);
    }
    // Return values: prefer Google Fit value when present, otherwise return stored DB value
    const weightToReturn = (weight !== null && weight !== undefined) ? weight : (user.weight || null);

    res.json({ 
      steps, 
      weight: weightToReturn, 
      lastSync: user.lastSync,
      name: user.name || null,
      picture: user.picture || null
    });
  } catch (err) {
    console.error('Failed to fetch Google Fit data:', err);
    // If Google Fit fetch fails, return stored data instead of error
    // This ensures the frontend always gets data even if sync fails
    if (user) {
      console.log(`📊 Returning stored data due to Google Fit sync error for ${user.email}`);
      res.json({ 
        steps: user.steps || 0, 
        weight: user.weight || null, 
        lastSync: user.lastSync || null,
        name: user.name || null,
        picture: user.picture || null
      });
    } else {
      console.error('User not found, cannot return stored data');
      res.status(500).json({ error: 'Failed to fetch user data', details: err.message });
    }
  }
});

// PUT /api/user/profile - update user profile (name and picture)
router.put('/profile', async (req, res) => {
  const { googleId, name, picture } = req.body;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId' });
  }
  
  if (!name && !picture) {
    return res.status(400).json({ error: 'At least one field (name or picture) must be provided' });
  }

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (picture !== undefined) updateData.picture = picture;

    const user = await User.findOneAndUpdate(
      { googleId },
      { $set: updateData },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Updated profile for user ${googleId}:`, updateData);
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture
      }
    });
  } catch (err) {
    console.error('❌ Failed to update user profile:', err);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

// GET /api/user/fitness-history/:googleId - get fitness history for a user
router.get('/fitness-history/:googleId', async (req, res) => {
  const { googleId } = req.params;
  const { startDate, endDate, limit } = req.query;
  
  if (!googleId) {
    return res.status(400).json({ error: 'Missing googleId parameter' });
  }
  
  try {
    const query = { userId: googleId };
    
    // Add date range if provided
    let normalizedStartDate = null;
    let normalizedEndDate = null;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        normalizedStartDate = FitnessHistory.normalizeDate(new Date(startDate));
        query.date.$gte = normalizedStartDate;
      }
      if (endDate) {
        normalizedEndDate = FitnessHistory.normalizeDate(new Date(endDate));
        normalizedEndDate.setHours(23, 59, 59, 999); // End of day
        query.date.$lte = normalizedEndDate;
      }
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 30; // Default to last 30 days
    
    
    // Fetch all entries (including duplicates for the same date)
    const allEntries = await FitnessHistory.find(query)
      .sort({ date: -1, updatedAt: -1 })
      .limit(limitNum * 2); // Get more entries to handle duplicates
    
    // Group entries by date and prioritize manual entries
    const entriesByDate = new Map();
    allEntries.forEach(entry => {
      const dateKey = entry.date?.toISOString();
      if (!dateKey) return;
      
      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey).push(entry);
    });
    
    // For each date, prioritize manual entries with weight, then any entry with weight
    const history = [];
    entriesByDate.forEach((entries, dateKey) => {
      // Sort entries: manual with weight first, then any with weight, then by updatedAt
      entries.sort((a, b) => {
        const aIsManual = a.source === 'manual' && a.weight !== null;
        const bIsManual = b.source === 'manual' && b.weight !== null;
        if (aIsManual && !bIsManual) return -1;
        if (!aIsManual && bIsManual) return 1;
        
        const aHasWeight = a.weight !== null && a.weight !== undefined;
        const bHasWeight = b.weight !== null && b.weight !== undefined;
        if (aHasWeight && !bHasWeight) return -1;
        if (!aHasWeight && bHasWeight) return 1;
        
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      
      // Use the best entry (first after sorting)
      history.push(entries[0]);
    });
    
    // Also check for manual entries that might not match the date query exactly
    // This is a safety net to ensure manual entries are included
    // Check for manual entries created/updated in the last 48 hours (in case date normalization differs or sync timing)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentManualEntries = await FitnessHistory.find({
      userId: googleId,
      source: 'manual',
      weight: { $ne: null },
      $or: [
        { createdAt: { $gte: twoDaysAgo } },
        { updatedAt: { $gte: twoDaysAgo } }
      ]
    }).sort({ updatedAt: -1 }); // Get most recent first
    
    
    // CRITICAL: Always include recent manual entries, even if they're outside the date range
    // Manual entries take precedence and should always be shown if they were created/updated recently
    // This ensures that manually entered weights appear immediately, even if the query date range doesn't include them yet
    const manualEntriesToInclude = recentManualEntries.filter(e => {
      const entryDateKey = e.date?.toISOString();
      if (!entryDateKey) return false;
      
      // Always include recent manual entries with weight, regardless of date range
      // This ensures manual entries are always visible
      return e.weight !== null && e.weight !== undefined;
    });
    
    
    // Merge recent manual entries with query results - they will be prioritized in the grouping step
    // Add them to allEntries so they get included in the grouping
    allEntries.push(...manualEntriesToInclude);
    
    // Re-group after adding manual entries
    entriesByDate.clear();
    allEntries.forEach(entry => {
      const dateKey = entry.date?.toISOString();
      if (!dateKey) return;
      
      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey).push(entry);
    });
    
    // Re-process history with manual entries included
    history.length = 0; // Clear existing history
    entriesByDate.forEach((entries, dateKey) => {
      // Sort entries: manual with weight first, then any with weight, then by updatedAt
      entries.sort((a, b) => {
        const aIsManual = a.source === 'manual' && a.weight !== null && a.weight !== undefined;
        const bIsManual = b.source === 'manual' && b.weight !== null && b.weight !== undefined;
        if (aIsManual && !bIsManual) return -1;
        if (!aIsManual && bIsManual) return 1;
        
        const aHasWeight = a.weight !== null && a.weight !== undefined;
        const bHasWeight = b.weight !== null && b.weight !== undefined;
        if (aHasWeight && !bHasWeight) return -1;
        if (!aHasWeight && bHasWeight) return 1;
        
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      
      // Use the best entry (first after sorting)
      history.push(entries[0]);
    });
    
    // Sort by date descending and limit
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedHistory = history.slice(0, limitNum);
    
    
    res.json(limitedHistory);
  } catch (err) {
    console.error('Error fetching fitness history:', err);
    res.status(500).json({ error: 'Failed to fetch fitness history', details: err.message });
  }
});

module.exports = router;

