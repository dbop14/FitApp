const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const FitnessHistory = require('../models/FitnessHistory');
const sdk = require('matrix-js-sdk');
const upload = require('../middleware/upload');

// Matrix client for creating rooms - will be authenticated on first use
let matrixClient = null;
let matrixClientInitialized = false;

const initializeMatrixClient = async () => {
  if (matrixClientInitialized && matrixClient) {
    return matrixClient;
  }

  try {
    const botUsername = process.env.BOT_USERNAME || 'fitness_motivator';
    const botPassword = process.env.BOT_PASSWORD;
    const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
    const matrixUrl = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';
    
    if (!botPassword) {
      console.error('⚠️ BOT_PASSWORD not set, Matrix room creation will fail');
      return null;
    }
    
    const client = sdk.createClient({
      baseUrl: matrixUrl,
    });

    // Login with password authentication
    const response = await client.login('m.login.password', {
      identifier: {
        type: 'm.id.user',
        user: botUsername
      },
      password: botPassword,
    });

    // Set access token from login response
    if (response.access_token) {
      client.setAccessToken(response.access_token);
    } else {
      throw new Error('Login failed: No access token received');
    }
    matrixClient = client;
    matrixClientInitialized = true;
    
    console.log('✅ Matrix client initialized for room creation');
    return client;
  } catch (err) {
    console.error('❌ Matrix client initialization failed:', err.message);
    return null;
  }
};

// Create a new challenge with chat room
router.post('/', async (req, res) => {
  
  try {
    const { 
      name, 
      startDate, 
      endDate, 
      stepGoal, 
      isPublic, 
      creatorEmail, 
      botName, 
      botAvatar, 
      challengeCode, 
      weighInDay,
      startingWeight,
      userGoogleId, // Add this to identify the admin
      picture, // Add profile picture
      userName, // Add user's actual name
      photo // Add challenge photo URL
    } = req.body;

    // Validate that end date/time is not before start date/time
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid start or end date/time' })
      }

      if (end < start) {
        return res.status(400).json({ error: 'End date/time cannot be before start date/time' })
      }
    }

    // Create challenge in database
    const challenge = new Challenge({
      name,
      startDate,
      endDate,
      stepGoal,
      isPublic,
      creatorEmail,
      admin: userGoogleId, // Set the admin to the creator's Google ID
      participants: [creatorEmail],
      challengeCode: challengeCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
      botName: botName || 'Fitness Motivator',
      botAvatar: botAvatar || '🤖',
      weighInDay: weighInDay || 'monday',
      photo: photo || null // Add challenge photo
    });

    await challenge.save();

    // Ensure user record exists and create participant record for the creator
    try {
      const User = require('../models/User');
      
      // First, ensure the user record exists with profile picture
      let user = await User.findOne({ googleId: userGoogleId });
      if (!user) {
        // Check if challenge starts in the future to determine default weight
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const challengeStart = challenge.startDate ? new Date(challenge.startDate) : null;
        if (challengeStart) {
          challengeStart.setHours(0, 0, 0, 0);
        }
        const isFutureChallenge = challengeStart && challengeStart > today;
        
        // For future challenges, don't set weight (will be set on first weigh-in day)
        // For current/past challenges, use startingWeight or default to 154
        const defaultUserWeight = isFutureChallenge && (startingWeight === null || startingWeight === undefined)
          ? null
          : (startingWeight || 154);
        
        // Create user record if it doesn't exist
        user = new User({
          googleId: userGoogleId,
          name: userName || creatorEmail.split('@')[0], // Use actual name or email prefix as fallback
          email: creatorEmail,
          picture: picture || null, // Use provided picture
          steps: 0,
          weight: defaultUserWeight,
          lastSync: new Date()
        });
        await user.save();
        console.log(`✅ Created user record for challenge creator: ${creatorEmail} with name: ${user.name}`);
      } else {
        // Update existing user record with latest info
        user.name = userName || user.name; // Update name if provided
        user.email = creatorEmail;
        if (picture) {
          user.picture = picture; // Update picture if provided
        }
        await user.save();
        console.log(`✅ Updated existing user record for challenge creator: ${creatorEmail} with name: ${user.name}`);
      }
      
      // Check if participant already exists to prevent duplicates
      const existingParticipant = await ChallengeParticipant.findOne({
        challengeId: challenge._id.toString(),
        userId: userGoogleId
      });
      
      if (!existingParticipant) {
        // Check if challenge starts in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const challengeStart = challenge.startDate ? new Date(challenge.startDate) : null;
        if (challengeStart) {
          challengeStart.setHours(0, 0, 0, 0);
        }
        const isFutureChallenge = challengeStart && challengeStart > today;
        
        // For ALL challenges, startingWeight should be null until confirmed on first weigh-in day
        // Only set lastWeight if we have a value (for display purposes), but startingWeight stays null
        const validStartingWeight = null; // Always null until confirmed on first weigh-in day
        
        // Get lastWeight from provided startingWeight or user's current weight, or null
        let validLastWeight = null;
        if (startingWeight && !isNaN(parseFloat(startingWeight))) {
          validLastWeight = parseFloat(startingWeight);
        } else if (user && user.weight) {
          validLastWeight = user.weight;
        }
        
        // Create participant record for the creator
        const participant = new ChallengeParticipant({
          challengeId: challenge._id.toString(),
          userId: userGoogleId,
          startingWeight: validStartingWeight, // Always null until confirmed on first weigh-in day
          lastWeight: validLastWeight, // Can be set for display, but startingWeight stays null
          points: 0,
          lastStepDate: null,
          lastStepCount: 0
        });
        await participant.save();
        console.log(`✅ Created participant record for challenge creator: ${creatorEmail}${isFutureChallenge ? ' (future challenge, starting weight will be set on first weigh-in day)' : ''}`);
      } else {
        console.log(`⚠️ Participant record already exists for: ${creatorEmail}`);
      }
    } catch (participantError) {
      console.error('Error creating participant record:', participantError);
      // Continue without participant record if it fails
    }

    // Create Matrix chat room for the challenge
    try {
      // Initialize Matrix client if not already done
      const client = await initializeMatrixClient();
      if (!client) {
        console.error('⚠️ Cannot create Matrix room: client not initialized');
        // Continue without Matrix room
      } else {
        // First, try to resolve existing room alias (in case room was created but ID wasn't saved)
        const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
        const roomAlias = `#challenge-${challenge._id}:${matrixServerName}`;
        let roomId = null;
        
        try {
          const roomInfo = await client.getRoomIdForAlias(roomAlias);
          if (roomInfo && roomInfo.room_id) {
            console.log(`✅ Found existing Matrix room: ${roomInfo.room_id}`);
            roomId = roomInfo.room_id;
          }
        } catch (aliasErr) {
          // Alias doesn't exist, will create new room
          console.log(`   Room alias doesn't exist, creating new room...`);
        }
        
        // Create room if it doesn't exist
        if (!roomId) {
          const roomOptions = {
            preset: 'public_chat',
            name: `${name} - Fitness Challenge`,
            topic: `Fitness challenge: ${stepGoal} steps daily goal. Duration: ${startDate} to ${endDate}`,
            visibility: 'public'
          };
          
          // Try with alias first
          try {
            roomOptions.room_alias_name = `challenge-${challenge._id}`;
            const createResponse = await client.createRoom(roomOptions);
            // Handle both string (old API) and object (new API) responses
            roomId = typeof createResponse === 'string' ? createResponse : (createResponse.room_id || createResponse);
            console.log(`✅ Created Matrix room: ${roomId}`);
          } catch (createErr) {
            // If alias is taken, create without alias
            if (createErr.data && createErr.data.errcode === 'M_ROOM_IN_USE') {
              console.log(`   Room alias is taken, creating room without alias...`);
              delete roomOptions.room_alias_name;
              const createResponse = await client.createRoom(roomOptions);
              // Handle both string (old API) and object (new API) responses
              roomId = typeof createResponse === 'string' ? createResponse : (createResponse.room_id || createResponse);
              console.log(`✅ Created Matrix room (without alias): ${roomId}`);
            } else {
              throw createErr;
            }
          }
        }
        
        // Update challenge with room ID
        if (roomId) {
          challenge.matrixRoomId = roomId;
          await challenge.save();
          console.log(`✅ Saved Matrix room ID to challenge "${challenge.name}": ${roomId}`);
        } else {
          console.error(`❌ Failed to create Matrix room for challenge "${challenge.name}" - no roomId returned`);
        }
      }
    } catch (matrixError) {
      console.error('❌ Matrix room creation failed:', matrixError.message);
      if (matrixError.data) {
        console.error('   Error details:', JSON.stringify(matrixError.data, null, 2));
      }
      // Continue without Matrix room if it fails
    }

    // Log final challenge state
    console.log(`✅ Challenge created: "${challenge.name}" (ID: ${challenge._id}, Matrix Room: ${challenge.matrixRoomId || 'NONE'})`);

    res.json({ success: true, challenge });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// Upload challenge photo
router.post('/:challengeId/photo', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
      }
      if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ error: 'Only image files are allowed.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Update challenge with photo URL
    challenge.photo = `/uploads/challenges/${req.file.filename}`;
    await challenge.save();

    res.json({ 
      success: true, 
      photo: challenge.photo,
      message: 'Photo uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Update challenge photo (for admin use)
router.put('/:challengeId/photo', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
      }
      if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ error: 'Only image files are allowed.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Update challenge with new photo URL
    challenge.photo = `/uploads/challenges/${req.file.filename}`;
    await challenge.save();

    res.json({ 
      success: true, 
      photo: challenge.photo,
      message: 'Photo updated successfully' 
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// Delete challenge photo
router.delete('/:challengeId/photo', async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Remove photo from challenge
    challenge.photo = null;
    await challenge.save();

    res.json({ 
      success: true, 
      message: 'Photo deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Join a challenge
router.post('/join/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { userEmail } = req.body;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (challenge.participants.includes(userEmail)) {
      return res.status(400).json({ error: 'Already participating in this challenge' });
    }

    challenge.participants.push(userEmail);
    await challenge.save();

    // Add user to Matrix room if it exists
    if (challenge.matrixRoomId) {
      try {
        const client = await initializeMatrixClient();
        if (client) {
          await client.invite(challenge.matrixRoomId, `@${userEmail}:fitapp.local`);
        }
      } catch (matrixError) {
        console.error('Failed to invite user to Matrix room:', matrixError);
      }
    }

    res.json({ success: true, challenge });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ error: 'Failed to join challenge' });
  }
});

// Get all challenges
router.get('/', async (req, res) => {
  try {
    const challenges = await Challenge.find({ isPublic: true });
    res.json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// Get challenge by code
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const challenge = await Challenge.findOne({ challengeCode: code });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge by code:', error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

// Get challenge by ID
router.get('/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const challenge = await Challenge.findById(challengeId);
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

// Get user's challenges
router.get('/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const challenges = await Challenge.find({
      participants: userEmail
    });
    
    res.json(challenges);
  } catch (error) {
    console.error('Error fetching user challenges:', error);
    res.status(500).json({ error: 'Failed to fetch user challenges' });
  }
});

// Update challenge
router.put('/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const updateData = req.body;
    const { _delete, userGoogleId, ...updateFields } = updateData;
    
    // Get the challenge to verify admin permissions
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    // Verify admin permissions for any update
    if (challenge.admin !== userGoogleId) {
      return res.status(403).json({ error: 'Only the challenge admin can perform this action' });
    }
    
    if (_delete) {
      // Admin is quitting - delete the challenge and all related data
      console.log(`🗑️ Admin ${userGoogleId} is deleting challenge ${challengeId} (${challenge.name})`);
      
      try {
        // First, get all participants to log who's being removed
        const User = require('../models/User');
        // Convert challengeId to string to match ChallengeParticipant schema
        const challengeIdStr = String(challengeId);
        const participants = await ChallengeParticipant.find({ challengeId: challengeIdStr });
        console.log(`👥 Removing ${participants.length} participant(s) from challenge:`);
        for (const participant of participants) {
          const user = await User.findOne({ googleId: participant.userId });
          const userName = user?.name || user?.email || participant.userId;
          console.log(`  - ${userName} (${participant.points} points, ${participant.stepGoalPoints || 0} step points)`);
        }
        
        // Delete all participants - challengeIdStr already set above
        const deletedParticipants = await ChallengeParticipant.deleteMany({ challengeId: challengeIdStr });
        console.log(`🗑️ Deleted ${deletedParticipants.deletedCount} participant record(s) for challenge ${challengeId}`);
        
        // Delete all chat messages
        const ChatMessage = require('../models/ChatMessage');
        const deletedMessages = await ChatMessage.deleteMany({ challengeId: challengeIdStr });
        console.log(`🗑️ Deleted ${deletedMessages.deletedCount} chat message(s) for challenge ${challengeId}`);
        
        // Delete the Matrix room if it exists
        if (challenge.matrixRoomId) {
          try {
            await matrixClient.leave(challenge.matrixRoomId);
            console.log(`🗑️ Left Matrix room ${challenge.matrixRoomId}`);
          } catch (matrixError) {
            console.error('Error leaving Matrix room:', matrixError);
          }
        }
        
        // Delete the challenge
        await Challenge.findByIdAndDelete(challengeId);
        console.log(`🗑️ Deleted challenge "${challenge.name}" (${challengeId})`);
        
        return res.json({ 
          deleted: true, 
          message: `Challenge "${challenge.name}" and all associated data deleted successfully`,
          participantsRemoved: participants.length,
          messagesDeleted: deletedMessages.deletedCount
        });
      } catch (deleteError) {
        console.error('Error deleting challenge data:', deleteError);
        return res.status(500).json({ error: 'Failed to delete challenge data', details: deleteError.message });
      }
    }
    
    // Update the challenge
    const updatedChallenge = await Challenge.findByIdAndUpdate(
      challengeId,
      updateFields,
      { new: true }
    );
    
    res.json(updatedChallenge);
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(500).json({ error: 'Failed to update challenge' });
  }
});

// Get participant data for a specific user in a specific challenge
router.get('/:challengeId/participant/:userId', async (req, res) => {
  try {
    const { challengeId, userId } = req.params;
    
    // Find the participant record
    const participant = await ChallengeParticipant.findOne({ 
      challengeId: challengeId, 
      userId: userId 
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in this challenge' });
    }
    
    // Get the challenge details
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    // Get the user details
    const User = require('../models/User');
    const user = await User.findOne({ googleId: userId });
    
    // Check FitnessHistory for the most recent weight entry
    const mostRecentWeightEntry = await FitnessHistory.findOne(
      { userId: userId, weight: { $ne: null } },
      {},
      { sort: { date: -1 } }
    );
    
    // Check if there's a manual entry for today (manual entries take precedence)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDate = FitnessHistory.normalizeDate(today);
    const manualEntryToday = await FitnessHistory.findOne({
      userId: userId,
      date: normalizedDate,
      source: 'manual'
    });
    
    // Determine the most recent weight: 
    // 1. If there's a manual entry for today, use it (manual entries take absolute precedence)
    // 2. Otherwise, use participant.lastWeight if it exists (it reflects the most recent manual submission)
    // 3. Fall back to FitnessHistory if participant.lastWeight is null
    let lastWeight;
    
    if (manualEntryToday && manualEntryToday.weight !== null && manualEntryToday.weight !== undefined) {
      // Manual entry for today exists - use it (manual entries take precedence)
      lastWeight = manualEntryToday.weight;
    } else if (participant.lastWeight !== undefined && participant.lastWeight !== null) {
      // Use participant.lastWeight (it reflects the most recent manual submission or Google Fit sync)
      lastWeight = participant.lastWeight;
    } else if (mostRecentWeightEntry && mostRecentWeightEntry.weight) {
      // No participant.lastWeight, fall back to FitnessHistory
      lastWeight = mostRecentWeightEntry.weight;
    } else {
      // No weight found anywhere, fall back to startingWeight
      lastWeight = participant.startingWeight;
    }
    
    
    // Return participant data with challenge and user context
    res.json({
      participant: {
        _id: participant._id,
        challengeId: participant.challengeId,
        userId: participant.userId,
        startingWeight: participant.startingWeight,
        lastWeight: lastWeight, // Use startingWeight if lastWeight is null
        points: participant.points,
        stepGoalPoints: participant.stepGoalPoints || 0,
        weightLossPoints: participant.weightLossPoints || 0,
        stepGoalDaysAchieved: participant.stepGoalDaysAchieved || 0,
        lastStepDate: participant.lastStepDate,
        lastStepCount: participant.lastStepCount
      },
      challenge: {
        _id: challenge._id,
        name: challenge.name,
        stepGoal: challenge.stepGoal,
        startDate: challenge.startDate,
        endDate: challenge.endDate
      },
      user: user ? {
        name: user.name,
        email: user.email,
        picture: user.picture
      } : null
    });
    
  } catch (error) {
    console.error('Error fetching participant data:', error);
    res.status(500).json({ error: 'Failed to fetch participant data' });
  }
});

// Update participant weight
router.put('/:challengeId/participant/:userId/weight', async (req, res) => {
  try {
    const { challengeId, userId } = req.params;
    const { weight, date } = req.body; // Accept optional date parameter from frontend

    // Validate weight
    if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
      return res.status(400).json({ error: 'Invalid weight value' });
    }

    const weightValue = parseFloat(weight);

    // Find the participant record
    const participant = await ChallengeParticipant.findOne({ 
      challengeId: challengeId, 
      userId: userId 
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in this challenge' });
    }

    // Get the challenge to verify it exists
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Update the participant's last weight
    const oldLastWeight = participant.lastWeight;
    participant.lastWeight = weightValue;
    
    // Determine the date to use: use provided date (user's local date) or fall back to server date
    let today;
    if (date) {
      // Parse the date string (YYYY-MM-DD format from frontend)
      // Split the date string and create a date object using local time components
      // This ensures the date is interpreted in the server's local timezone, not UTC
      const [year, month, day] = date.split('-').map(Number);
      today = new Date(year, month - 1, day); // month is 0-indexed in JavaScript
      today.setHours(0, 0, 0, 0);
    } else {
      // Fall back to server date if no date provided
      today = new Date();
      today.setHours(0, 0, 0, 0);
    }
    
    // If startingWeight is null and this is the first weigh-in day, set it as startingWeight
    // Check if today is the first weigh-in day for this challenge
    const startDate = challenge.startDate ? new Date(challenge.startDate) : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    
    // Check if today is a weigh-in day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = dayNames[today.getDay()];
    const isWeighInDay = challenge.weighInDay && challenge.weighInDay.toLowerCase() === todayDayName;
    
    
    // Check if this is the first weigh-in day (on or after start date)
    // IMPORTANT: If startingWeight is null and the challenge has started, 
    // this MUST be treated as the first weigh-in day (user hasn't confirmed starting weight yet)
    let isFirstWeighInDay = false;
    
    
    // CRITICAL FIX: If startingWeight is null and challenge has started, set it as first weigh-in day
    // This ensures startingWeight is set even if today doesn't match the weigh-in day exactly
    if (participant.startingWeight === null || participant.startingWeight === undefined) {
      if (startDate && today >= startDate) {
        // Challenge has started and startingWeight is null - this is the first weigh-in
        isFirstWeighInDay = true;
      }
    } else if (startDate && isWeighInDay && today >= startDate) {
      // StartingWeight exists - check if today is the calculated first weigh-in day
      // Find the first weigh-in day on or after the start date
      const firstWeighInDay = new Date(startDate);
      const startDayName = dayNames[firstWeighInDay.getDay()];
      const weighInDayIndex = dayNames.indexOf(challenge.weighInDay.toLowerCase());
      const startDayIndex = dayNames.indexOf(startDayName);
      
      // Calculate days until first weigh-in day
      let daysUntilWeighIn = (weighInDayIndex - startDayIndex + 7) % 7;
      if (daysUntilWeighIn === 0 && startDayName === challenge.weighInDay.toLowerCase()) {
        // Start date is already a weigh-in day
        daysUntilWeighIn = 0;
      }
      
      firstWeighInDay.setDate(firstWeighInDay.getDate() + daysUntilWeighIn);
      firstWeighInDay.setHours(0, 0, 0, 0);
      
      // Check if today is the first weigh-in day
      isFirstWeighInDay = today.getTime() === firstWeighInDay.getTime();
    } else {
    }
    
    
    // If this is the first weigh-in day, set/update startingWeight
    // This allows updating startingWeight if it was incorrectly set earlier
    if (isFirstWeighInDay) {
      const oldStartingWeight = participant.startingWeight;
      participant.startingWeight = weightValue;
      if (oldStartingWeight !== weightValue) {
        console.log(`✅ ${oldStartingWeight ? 'Updated' : 'Set'} starting weight on first weigh-in day: ${oldStartingWeight || 'null'} → ${weightValue} lbs`);
      } else {
        console.log(`✅ Starting weight confirmed on first weigh-in day: ${weightValue} lbs`);
      }
    }
    
    // Helper function for weight loss points rounding
    // .5 or higher rounds up, .4 or lower rounds down
    // Ensures points are never negative (minimum 0)
    const roundWeightLossPoints = (percentage) => {
      // Ensure percentage is never negative (safety check)
      const safePercentage = Math.max(0, percentage);
      const decimal = safePercentage % 1;
      if (decimal >= 0.5) {
        return Math.ceil(safePercentage);
      } else {
        return Math.floor(safePercentage);
      }
    };
    
    // Calculate weight loss points continuously throughout the challenge
    if (participant.startingWeight) {
      const totalWeightLost = participant.startingWeight - weightValue;
      const totalPercentLost = Math.max(0, (totalWeightLost / participant.startingWeight) * 100);
      
      // Calculate weight loss points with custom rounding
      const weightLossPoints = roundWeightLossPoints(totalPercentLost);
      participant.weightLossPoints = weightLossPoints;
      
      // Total points = step points + weight loss points (always included)
      const stepPoints = participant.stepGoalPoints || 0;
      participant.points = stepPoints + weightLossPoints;
      
      console.log(`✅ Weight loss points calculated: ${weightLossPoints} (${totalPercentLost.toFixed(2)}% lost)`);
      console.log(`📊 Total points: ${stepPoints} step points + ${weightLossPoints} weight loss = ${participant.points} total`);
      console.log(`📊 Weight update: ${oldLastWeight || 'null'} → ${weightValue} lbs (starting: ${participant.startingWeight} lbs)`);
    } else {
      // No starting weight - only step points count
      const stepPoints = participant.stepGoalPoints || 0;
      participant.points = stepPoints;
      console.log(`📊 Weight updated: ${weightValue.toFixed(1)} lbs (points: ${stepPoints} step points, no starting weight yet)`);
    }

    
    await participant.save();
    

    // Also update the user's weight in the User model
    const User = require('../models/User');
    const user = await User.findOne({ googleId: userId });
    if (user) {
      user.weight = weightValue;
      await user.save();
    }

    // Store historical weight data for the specified date (manual entry)
    // Use the 'today' variable which may be from user's local date or server date
    const historyDate = FitnessHistory.normalizeDate(today);
    
    
    // Check if there's an existing entry for a different date that should be moved
    // This handles the case where the user wants to correct the date of a previous entry
    const existingEntryForDate = await FitnessHistory.findOne({
      userId: userId,
      date: historyDate,
      source: 'manual'
    });
    
    // If there's already a manual entry for this date, update it
    // Otherwise, create a new entry (upsert will handle this)
    const savedEntry = await FitnessHistory.findOneAndUpdate(
      { userId: userId, date: historyDate },
      {
        $set: {
          weight: weightValue,
          source: 'manual',
          updatedAt: new Date()
        },
        $setOnInsert: {
          steps: 0, // Default steps if creating new entry
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    

    console.log(`✅ Updated weight for participant ${userId} in challenge ${challengeId}: ${weightValue} lbs`);

    const responseData = {
      success: true,
      participant: {
        userId: participant.userId,
        lastWeight: participant.lastWeight,
        startingWeight: participant.startingWeight,
        points: participant.points,
        weightLossPoints: participant.weightLossPoints || 0
      }
    };
    
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Error updating participant weight:', error);
    res.status(500).json({ error: 'Failed to update participant weight' });
  }
});

// GET /api/challenge/:challengeId/participant/:userId/fitness-history - get fitness history for a participant
router.get('/:challengeId/participant/:userId/fitness-history', async (req, res) => {
  try {
    const { challengeId, userId } = req.params;
    const { startDate, endDate, limit } = req.query;
    
    // Verify participant exists
    const participant = await ChallengeParticipant.findOne({ 
      challengeId: challengeId, 
      userId: userId 
    });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in this challenge' });
    }
    
    const FitnessHistory = require('../models/FitnessHistory');
    const query = { userId: userId };
    
    // Add date range if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = FitnessHistory.normalizeDate(new Date(startDate));
      }
      if (endDate) {
        const end = FitnessHistory.normalizeDate(new Date(endDate));
        end.setHours(23, 59, 59, 999); // End of day
        query.date.$lte = end;
      }
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 30; // Default to last 30 days
    
    const history = await FitnessHistory.find(query)
      .sort({ date: -1 })
      .limit(limitNum);
    
    res.json({
      participant: {
        userId: participant.userId,
        startingWeight: participant.startingWeight,
        lastWeight: participant.lastWeight
      },
      history: history
    });
  } catch (error) {
    console.error('Error fetching participant fitness history:', error);
    res.status(500).json({ error: 'Failed to fetch fitness history', details: error.message });
  }
});

module.exports = router; 