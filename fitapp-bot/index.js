const sdk = require('matrix-js-sdk');
const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();

// Import models
const Challenge = require('./models/Challenge');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const User = require('./models/User');
const ChatMessage = require('./models/ChatMessage'); // You'll need to create this model or import from backend

// MongoDB connection
let mongoConnected = false;
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp');
    mongoConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
};

// Matrix client setup
let matrixClient = null;
let matrixConnected = false;
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_WAIT_TIME = 120000; // 2 minutes max wait (prevents Docker timeouts)
const MAX_RATE_LIMIT_RETRIES = 3; // Give up after 3 rate limit errors

const connectMatrix = async (retryCount = 0, rateLimitCount = 0) => {
  try {
    const botUsername = process.env.BOT_USERNAME || 'fitness_motivator';
    const botPassword = process.env.BOT_PASSWORD;
    const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
    const matrixUrl = process.env.MATRIX_HOMESERVER_URL || 'http://synapse:8008';
    
    if (!botPassword) {
      console.error('❌ BOT_PASSWORD environment variable is not set!');
      console.error('💡 Set BOT_PASSWORD in your .env file or docker-compose.yml');
      throw new Error('BOT_PASSWORD not set');
    }
    
    console.log(`🔄 Attempting to connect to Matrix (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    console.log(`   Username: ${botUsername}`);
    console.log(`   Server: ${matrixUrl}`);
    console.log(`   Domain: ${matrixServerName}`);
    
    const client = sdk.createClient({
      baseUrl: matrixUrl,
      userId: `@${botUsername}:${matrixServerName}`,
      accessToken: null, // Will be set after login
    });

    const response = await client.login('m.login.password', {
      user: botUsername,
      password: botPassword,
    });

    client.setAccessToken(response.access_token);
    matrixClient = client;
    matrixConnected = true;
    
    console.log('✅ Connected to Matrix');
    
    // Start the client
    await client.startClient({ initialSyncLimit: 10 });
    
    return client;
  } catch (err) {
    // Try multiple ways to get status code
    const statusCode = err.httpStatus || 
                      err.statusCode || 
                      err.status || 
                      (err.data && (err.data.statusCode || err.data.status)) ||
                      (err.message && err.message.match(/\[(\d+)\]/) ? parseInt(err.message.match(/\[(\d+)\]/)[1]) : null) ||
                      0;
    
    // Handle rate limiting (429) - wait but give up after too many
    if (statusCode === 429) {
      const newRateLimitCount = rateLimitCount + 1;
      
      // Give up if we've hit rate limits too many times
      if (newRateLimitCount > MAX_RATE_LIMIT_RETRIES) {
        console.error(`❌ Matrix rate limited too many times (${newRateLimitCount}). Giving up for now.`);
        console.error('⚠️  Bot will continue running and retry Matrix connection periodically.');
        return null;
      }
      
      // Try multiple ways to get retry_after_ms
      const retryAfterMs = err.data?.retry_after_ms || 
                          err.retry_after_ms || 
                          err.data?.retry_after || 
                          (err.data?.errcode === 'M_LIMIT_EXCEEDED' && err.data?.retry_after_ms) ||
                          (INITIAL_RETRY_DELAY * Math.pow(2, retryCount + 2));
      // Cap the delay to prevent Docker timeouts
      const delay = Math.min(Math.max(retryAfterMs, 60000), MAX_WAIT_TIME);
      
      if (retryCount < MAX_RETRIES - 1) {
        console.error(`❌ Matrix rate limited (attempt ${retryCount + 1}/${MAX_RETRIES}, rate limit #${newRateLimitCount}): ${err.message}`);
        console.log(`⏳ Waiting ${Math.round(delay / 1000)} seconds before retry (rate limit, capped at ${MAX_WAIT_TIME/1000}s)...`);
        
        try {
          // Wait with periodic logging to keep process alive and visible
          const logInterval = 30000; // Log every 30 seconds
          let elapsed = 0;
          
          while (elapsed < delay) {
            const remaining = delay - elapsed;
            const waitTime = Math.min(remaining, logInterval);
            
            console.log(`⏳ Still waiting... ${Math.round(remaining / 1000)} seconds remaining`);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            elapsed += waitTime;
          }
          
          console.log('✅ Wait complete, retrying Matrix connection...');
          return connectMatrix(retryCount + 1, newRateLimitCount);
        } catch (waitErr) {
          console.error('❌ Error during wait:', waitErr.message);
          throw waitErr;
        }
      }
    }
    
    // Handle authentication errors (403) - provide helpful message
    if (statusCode === 403) {
      const botUsername = process.env.BOT_USERNAME || 'fitness_motivator';
      const hasPassword = !!process.env.BOT_PASSWORD;
      
      console.error(`❌ Matrix authentication failed (attempt ${retryCount + 1}/${MAX_RETRIES}): Invalid username or password`);
      console.error('');
      console.error('🔍 Troubleshooting steps:');
      console.error('   1. Verify BOT_PASSWORD is set:');
      console.error(`      echo $BOT_PASSWORD  (should show a password, not empty)`);
      console.error(`      Has password: ${hasPassword ? '✅ Yes' : '❌ No'}`);
      console.error('');
      console.error('   2. Check if bot user exists in Matrix:');
      console.error(`      docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008`);
      console.error(`      Username: ${botUsername}`);
      console.error(`      Password: [your BOT_PASSWORD value]`);
      console.error('');
      
      if (retryCount < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return connectMatrix(retryCount + 1, rateLimitCount);
      }
    }
    
    // Other errors
    if (retryCount < MAX_RETRIES - 1) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.error(`❌ Matrix connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}): ${err.message}`);
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectMatrix(retryCount + 1, rateLimitCount);
    }
    
    // Max retries reached - don't throw, just log and return null
    console.error('❌ Failed to connect to Matrix after', MAX_RETRIES, 'attempts');
    console.error('⚠️  Bot will continue running but Matrix features will be unavailable.');
    console.error('   Fix the authentication issue and restart the bot to reconnect.');
    return null;
  }
};

// Send card message with text message below
const sendCardMessage = async (roomId, message, challengeId, botName, cardType, cardData, userPicture = null, userId = null) => {
  if (!matrixClient || !matrixConnected || !roomId) {
    console.log('⚠️  Cannot send Matrix message: client not connected or no room ID');
    return false;
  }

  try {
    // Send text message to Matrix (fallback)
    const content = {
      msgtype: 'm.text',
      body: message,
    };

    await matrixClient.sendEvent(roomId, 'm.room.message', content);
    console.log(`✅ Sent message to room ${roomId}: ${message.substring(0, 50)}...`);
    
    // Save card message to MongoDB
    if (challengeId && mongoConnected) {
      try {
        const chatMessage = new ChatMessage({
          challengeId: challengeId.toString(),
          sender: botName,
          message: message, // Full text message
          messageType: cardType,
          imageUrl: userPicture,
          cardData: cardData,
          isBot: true,
          isSystem: false,
          userId: userId,
          userPicture: userPicture,
          timestamp: new Date()
        });
        const savedMessage = await chatMessage.save();
        console.log(`✅ Saved card message to MongoDB for app display`);
        console.log(`   Message ID: ${savedMessage._id}`);
        console.log(`   Message Type: ${savedMessage.messageType}`);
        console.log(`   Challenge ID: ${savedMessage.challengeId}`);
        console.log(`   User ID: ${savedMessage.userId || 'none'}`);
        console.log(`   Has Card Data: ${!!savedMessage.cardData}`);
      } catch (dbErr) {
        console.error('⚠️  Failed to save card message to MongoDB:', dbErr.message);
        console.error('   Error details:', dbErr);
      }
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Error sending card message to room ${roomId}:`, err.message);
    return false;
  }
};

// Update sendMatrixMessage to also save to MongoDB (for backward compatibility)
const sendMatrixMessage = async (roomId, message, challengeId, botName = 'Fitness Motivator') => {
  if (!matrixClient || !matrixConnected || !roomId) {
    console.log('⚠️  Cannot send Matrix message: client not connected or no room ID');
    return false;
  }

  try {
    const content = {
      msgtype: 'm.text',
      body: message,
    };

    await matrixClient.sendEvent(roomId, 'm.room.message', content);
    console.log(`✅ Sent message to room ${roomId}: ${message.substring(0, 50)}...`);
    
    // Also save to MongoDB so it appears in the app
    if (challengeId && mongoConnected) {
      try {
        const chatMessage = new ChatMessage({
          challengeId: challengeId.toString(),
          sender: botName,
          message: message,
          isBot: true,
          isSystem: false,
          timestamp: new Date()
        });
        await chatMessage.save();
        console.log(`✅ Saved message to MongoDB for app display`);
      } catch (dbErr) {
        console.error('⚠️  Failed to save message to MongoDB:', dbErr.message);
        // Continue even if MongoDB save fails
      }
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Error sending Matrix message to room ${roomId}:`, err.message);
    return false;
  }
};

// Track previous step points to detect changes
const previousStepPoints = new Map(); // challengeId-userId -> stepGoalPoints
// Track welcomed participants (persist across restarts using participant _id timestamps)
const welcomedParticipants = new Set(); // challengeId-userId
// Track announced winners
const announcedWinners = new Set(); // challengeId

// Monitor step point changes
const checkStepPointChanges = async () => {
  if (!mongoConnected) return;

  try {
    const participants = await ChallengeParticipant.find({});
    
    for (const participant of participants) {
      const key = `${participant.challengeId}-${participant.userId}`;
      const previousPoints = previousStepPoints.get(key) || 0;
      const currentPoints = participant.stepGoalPoints || 0;

      // If points increased, someone earned a step point
      if (currentPoints > previousPoints) {
        previousStepPoints.set(key, currentPoints);
        
        // Get challenge and user info
        const challenge = await Challenge.findById(participant.challengeId);
        const user = await User.findOne({ googleId: participant.userId });
        
        if (challenge && challenge.matrixRoomId && user) {
          // Only send if challenge is active
          const now = new Date();
          const startDate = new Date(challenge.startDate);
          const endDate = new Date(challenge.endDate);
          
          if (now >= startDate && now <= endDate) {
            // Skip if winner already announced
            const challengeKey = challenge._id.toString();
            if (announcedWinners.has(challengeKey)) continue;

            const userName = user.name || user.email || 'Someone';
            const firstName = userName.split(' ')[0];
            const currentSteps = user.steps || participant.lastStepCount || challenge.stepGoal || 10000;
            const fullMessage = `${firstName} just earned a step point! Great job reaching your daily step goal of ${challenge.stepGoal} steps. Keep up the momentum!`;
            const botName = challenge.botName || 'Fitness Motivator';
            
            await sendCardMessage(
              challenge.matrixRoomId,
              fullMessage,
              challenge._id,
              botName,
              'stepGoalCard',
              {
                userName: firstName,
                stepCount: currentSteps,
                stepGoal: challenge.stepGoal || 10000,
                achievement: 'Step Goal Achieved!'
              },
              user.picture,
              participant.userId
            );
          }
        }
      } else if (currentPoints !== previousPoints) {
        // Update tracking even if points didn't increase (in case of reset)
        previousStepPoints.set(key, currentPoints);
      }
    }
  } catch (err) {
    console.error('❌ Error checking step point changes:', err.message);
  }
};

// Get day name from date
const getDayName = (date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

// Check if today is weigh-in day
const isWeighInDay = (weighInDay) => {
  if (!weighInDay) return false;
  const today = getDayName(new Date());
  return today.toLowerCase() === weighInDay.toLowerCase();
};

// Send daily step progress update (plain text, not a card)
const sendDailyStepUpdate = async () => {
  if (!mongoConnected) return;

  try {
    const now = new Date();
    const challenges = await Challenge.find({
      startDate: { $lte: now.toISOString().split('T')[0] },
      endDate: { $gte: now.toISOString().split('T')[0] }
    });

    for (const challenge of challenges) {
      if (!challenge.matrixRoomId) continue;

      // Skip if winner already announced
      const challengeKey = challenge._id.toString();
      if (announcedWinners.has(challengeKey)) continue;

      const participants = await ChallengeParticipant.find({ challengeId: challenge._id.toString() });
      const userMap = new Map();
      
      // Get all user info
      for (const participant of participants) {
        const user = await User.findOne({ googleId: participant.userId });
        if (user) {
          userMap.set(participant.userId, user);
        }
      }

      if (participants.length === 0) continue;

      // Build participant data with steps
      const participantData = [];
      for (const participant of participants) {
        const user = userMap.get(participant.userId);
        if (!user) continue;

        const fullName = user.name || user.email || 'Unknown';
        const firstName = fullName.split(' ')[0];
        const currentSteps = user.steps || participant.lastStepCount || 0;

        participantData.push({
          firstName: firstName,
          stepCount: currentSteps
        });
      }

      // Sort by step count (most to least)
      participantData.sort((a, b) => b.stepCount - a.stepCount);

      // Build message with exact format
      let message = `Here is an update of everyone's step goal progress for today!\n\n`;
      for (const data of participantData) {
        message += `${data.firstName} - ${data.stepCount.toLocaleString()}\n`;
      }

      const botName = challenge.botName || 'Fitness Motivator';
      // Send as plain text message, not a card
      await sendMatrixMessage(
        challenge.matrixRoomId,
        message,
        challenge._id,
        botName
      );
    }
  } catch (err) {
    console.error('❌ Error sending daily step update:', err.message);
  }
};

// Send weigh-in reminder (plain text, not a card)
const sendWeighInReminder = async () => {
  if (!mongoConnected) return;

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Find challenges that are active (started and not ended)
    const challenges = await Challenge.find({
      startDate: { $lte: now.toISOString().split('T')[0] },
      endDate: { $gte: now.toISOString().split('T')[0] }
    });

    for (const challenge of challenges) {
      if (!challenge.matrixRoomId || !isWeighInDay(challenge.weighInDay)) continue;

      // Skip if winner already announced
      const challengeKey = challenge._id.toString();
      if (announcedWinners.has(challengeKey)) continue;

      // Check if today is the first day of the challenge
      const startDate = challenge.startDate ? new Date(challenge.startDate) : null;
      let isFirstDay = false;
      if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        isFirstDay = startDateStr === today;
      }

      // For first weigh-in day, mention that this will be their starting weight
      let message;
      let cardTitle;
      let cardSubtitle;
      if (isFirstDay) {
        message = `Today is the first weigh-in day! Please log your current weight - this will be your starting weight for the challenge.`;
        cardTitle = 'First Weigh-In Day!';
        cardSubtitle = 'Log your starting weight';
      } else {
        message = `Today is weigh-in day! Please log your current weight to track your progress.`;
        cardTitle = 'Weigh-In Day!';
        cardSubtitle = 'Log your current weight';
      }
      
      const botName = challenge.botName || 'Fitness Motivator';
      // Send as card message
      await sendCardMessage(
        challenge.matrixRoomId,
        message,
        challenge._id,
        botName,
        'weighInReminderCard',
        {
          title: cardTitle,
          subtitle: cardSubtitle,
          challengeName: challenge.name
        },
        null, // No user picture for weigh-in reminders
        null  // No userId for bot messages
      );
    }
  } catch (err) {
    console.error('❌ Error sending weigh-in reminder:', err.message);
  }
};

// Track which participants we've celebrated (to avoid duplicates)
const celebratedWeightLoss = new Set(); // challengeId-userId-date

// Check for weight loss celebrations (runs after weigh-in day)
const checkWeightLossCelebrations = async () => {
  if (!mongoConnected) return;

  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDay = getDayName(yesterday);
    const todayStr = now.toISOString().split('T')[0];

    // Check challenges that had weigh-in day yesterday
    const challenges = await Challenge.find({
      startDate: { $lte: now.toISOString().split('T')[0] },
      endDate: { $gte: now.toISOString().split('T')[0] }
    });

    for (const challenge of challenges) {
      if (!challenge.matrixRoomId || !challenge.weighInDay) continue;
      
      // Only check if yesterday was weigh-in day
      if (yesterdayDay.toLowerCase() !== challenge.weighInDay.toLowerCase()) continue;

      const participants = await ChallengeParticipant.find({ challengeId: challenge._id.toString() });
      
      for (const participant of participants) {
        if (!participant.startingWeight || !participant.lastWeight) continue;

        const weightLost = participant.startingWeight - participant.lastWeight;
        
        // Only celebrate if weight was lost
        if (weightLost > 0) {
          const celebrationKey = `${challenge._id}-${participant.userId}-${todayStr}`;
          
          // Skip if already celebrated today
          if (celebratedWeightLoss.has(celebrationKey)) continue;
          
          const user = await User.findOne({ googleId: participant.userId });
          if (user && challenge.matrixRoomId) {
            // Skip if winner already announced
            const challengeKey = challenge._id.toString();
            if (announcedWinners.has(challengeKey)) continue;

            const userName = user.name || user.email || 'Someone';
            const firstName = userName.split(' ')[0];
            const message = `Congratulations ${firstName}! You've lost ${weightLost.toFixed(1)} pounds since the start of the challenge. That's amazing progress - keep up the great work!`;
            const botName = challenge.botName || 'Fitness Motivator';
            await sendCardMessage(
              challenge.matrixRoomId,
              message,
              challenge._id,
              botName,
              'weightLossCard',
              {
                userName: firstName,
                weightLost: weightLost.toFixed(1),
                startingWeight: participant.startingWeight,
                currentWeight: participant.lastWeight
              },
              user.picture,
              participant.userId
            );
            
            // Mark as celebrated
            celebratedWeightLoss.add(celebrationKey);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error checking weight loss celebrations:', err.message);
  }
};

// Announce challenge winner
const announceChallengeWinner = async () => {
  if (!mongoConnected) return;

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Find challenges that ended today or yesterday (in case we missed it)
    const challenges = await Challenge.find({
      endDate: { $lte: today }
    });

    for (const challenge of challenges) {
      if (!challenge.matrixRoomId) continue;

      const challengeKey = challenge._id.toString();
      
      // Skip if we've already announced winner for this challenge
      if (announcedWinners.has(challengeKey)) continue;
      
      const participants = await ChallengeParticipant.find({ challengeId: challengeKey })
        .sort({ points: -1 })
        .limit(1);

      if (participants.length === 0) continue;

      const winner = participants[0];
      const user = await User.findOne({ googleId: winner.userId });
      
      if (!user) continue;

      const userName = user.name || user.email || 'Unknown';
      const firstName = userName.split(' ')[0];
      const totalPoints = winner.points || 0;
      const stepPoints = winner.stepGoalPoints || 0;
      const weightLossPoints = winner.weightLossPoints || 0;

      let message = `Challenge Complete! The winner of ${challenge.name} is ${firstName} with ${totalPoints} total points!`;
      message += `\n\nBreakdown:`;
      message += `\n- Step Goal Points: ${stepPoints}`;
      message += `\n- Weight Loss Points: ${weightLossPoints}`;
      message += `\n\nCongratulations on your dedication and hard work!`;

      const botName = challenge.botName || 'Fitness Motivator';
      await sendCardMessage(
        challenge.matrixRoomId,
        message,
        challenge._id,
        botName,
        'winnerCard',
        {
          userName: firstName,
          totalPoints: totalPoints,
          stepPoints: stepPoints,
          weightLossPoints: weightLossPoints,
          challengeName: challenge.name
        },
        user.picture,
        winner.userId
      );
      
      // Mark as announced - this prevents all future messages for this challenge
      announcedWinners.add(challengeKey);
    }
  } catch (err) {
    console.error('❌ Error announcing challenge winner:', err.message);
  }
};

// Welcome new participants
const checkNewParticipants = async () => {
  if (!mongoConnected) return;

  try {
    const participants = await ChallengeParticipant.find({});
    
    for (const participant of participants) {
      const key = `${participant.challengeId}-${participant.userId}`;
      
      // Skip if already welcomed in this session
      if (welcomedParticipants.has(key)) {
        continue;
      }

      const challenge = await Challenge.findById(participant.challengeId);
      const user = await User.findOne({ googleId: participant.userId });
      
      if (!challenge) {
        console.log(`⚠️  Challenge not found for participant: ${participant.challengeId}`);
        continue;
      }
      
      if (!challenge.matrixRoomId) {
        console.log(`⚠️  Challenge ${challenge.name} has no Matrix room ID, attempting to create one...`);
        
        // Try to create Matrix room for this challenge
        if (!matrixClient || !matrixConnected) {
          console.log(`⚠️  Cannot create Matrix room: client not connected`);
          continue;
        }
        
        try {
          const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
          const roomAlias = `#challenge-${challenge._id}:${matrixServerName}`;
          let roomId = null;
          
          // First, try to resolve existing room alias
          try {
            const roomInfo = await matrixClient.getRoomIdForAlias(roomAlias);
            if (roomInfo && roomInfo.room_id) {
              console.log(`✅ Found existing Matrix room: ${roomInfo.room_id}`);
              roomId = roomInfo.room_id;
            }
          } catch (aliasErr) {
            // Alias doesn't exist, will create new room
          }
          
          // Create room if it doesn't exist
          if (!roomId) {
            const roomOptions = {
              preset: 'public_chat',
              name: `${challenge.name} - Fitness Challenge`,
              topic: `Fitness challenge: ${challenge.stepGoal || 10000} steps daily goal. Duration: ${challenge.startDate} to ${challenge.endDate}`,
              visibility: 'public'
            };
            
            try {
              roomOptions.room_alias_name = `challenge-${challenge._id}`;
              roomId = await matrixClient.createRoom(roomOptions);
              console.log(`✅ Created Matrix room: ${roomId}`);
            } catch (createErr) {
              // If alias is taken, create without alias
              if (createErr.data && createErr.data.errcode === 'M_ROOM_IN_USE') {
                delete roomOptions.room_alias_name;
                roomId = await matrixClient.createRoom(roomOptions);
                console.log(`✅ Created Matrix room (without alias): ${roomId}`);
              } else {
                throw createErr;
              }
            }
          }
          
          // Save room ID to challenge
          if (roomId) {
            challenge.matrixRoomId = roomId;
            await challenge.save();
            console.log(`✅ Saved Matrix room ID to challenge ${challenge.name}`);
          }
        } catch (matrixErr) {
          console.error(`❌ Failed to create Matrix room for challenge ${challenge.name}:`, matrixErr.message);
          // Continue without Matrix room - will try again next time
          continue;
        }
      }
      
      if (!user) {
        console.log(`⚠️  User not found for participant: ${participant.userId}`);
        continue;
      }
      
      if (challenge && challenge.matrixRoomId && user) {
        const userName = user.name || user.email || 'New participant';
        const botName = challenge.botName || 'Fitness Motivator';
        
        // Check if a welcome message already exists for this participant
        // Check both with userId and by message content to catch any edge cases
        const existingWelcome = await ChatMessage.findOne({
          challengeId: challenge._id.toString(),
          messageType: 'welcomeCard',
          $or: [
            { userId: participant.userId },
            { sender: botName, message: { $regex: userName.split(' ')[0], $options: 'i' } }
          ],
          isBot: true
        });
        
        // If welcome message already exists, mark as welcomed and skip
        if (existingWelcome) {
          welcomedParticipants.add(key);
          console.log(`⏭️  Welcome card already exists for ${userName}, skipping`);
          continue;
        }
        
        // Check if participant was created recently (within last 1 hour)
        // Using _id timestamp (MongoDB ObjectId contains creation timestamp)
        const participantId = participant._id;
        const createdAt = participantId.getTimestamp();
        const now = new Date();
        const timeDiff = now - createdAt;
        const oneHour = 60 * 60 * 1000; // 1 hour window
        
        // Welcome if created recently (within 1 hour) OR if challenge started recently
        const challengeStartDate = new Date(challenge.startDate);
        const challengeStartedRecently = (now - challengeStartDate) <= (7 * 24 * 60 * 60 * 1000); // Within last 7 days
        
        if (timeDiff <= oneHour || challengeStartedRecently) {
          // Skip if winner already announced
          const challengeKey = challenge._id.toString();
          if (announcedWinners.has(challengeKey)) continue;

          const firstName = userName.split(' ')[0];
          const message = `Welcome ${firstName} to the ${challenge.name} challenge! We're excited to have you on this fitness journey. Let's achieve our goals together!`;
          
          console.log(`👋 Welcoming new participant: ${firstName} to challenge ${challenge.name}`);
          console.log(`   Challenge ID: ${challenge._id}`);
          console.log(`   Matrix Room ID: ${challenge.matrixRoomId}`);
          console.log(`   User ID: ${participant.userId}`);
          console.log(`   User Picture: ${user.picture || 'none'}`);
          
          const success = await sendCardMessage(
            challenge.matrixRoomId,
            message,
            challenge._id,
            botName,
            'welcomeCard',
            {
              userName: firstName,
              challengeName: challenge.name
            },
            user.picture,
            participant.userId
          );
          
          if (success) {
            // Mark as welcomed
            welcomedParticipants.add(key);
            console.log(`✅ Successfully sent welcome card for ${userName}`);
            
            // Verify the message was saved
            setTimeout(async () => {
              const savedMessage = await ChatMessage.findOne({
                challengeId: challenge._id.toString(),
                messageType: 'welcomeCard',
                userId: participant.userId,
                isBot: true
              });
              if (savedMessage) {
                console.log(`✅ Verified welcome card saved to database: ${savedMessage._id}`);
              } else {
                console.error(`❌ WARNING: Welcome card not found in database after sending!`);
              }
            }, 1000);
          } else {
            console.log(`⚠️  Failed to send welcome card for ${userName}`);
          }
        } else {
          console.log(`⏭️  Skipping welcome for ${user.name || user.email} - joined ${Math.round(timeDiff / (60 * 1000))} minutes ago (outside 1 hour window)`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error checking new participants:', err.message);
    console.error(err.stack);
  }
};

// Send challenge start reminders (plain text, not a card)
const sendChallengeStartReminders = async () => {
  if (!mongoConnected) return;

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find challenges starting tomorrow
    const challenges = await Challenge.find({
      startDate: tomorrowStr
    });

    for (const challenge of challenges) {
      if (!challenge.matrixRoomId) continue;

      // Skip if winner already announced
      const challengeKey = challenge._id.toString();
      if (announcedWinners.has(challengeKey)) continue;

      const startDate = new Date(challenge.startDate);
      const formattedDate = startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      let message = `Reminder: The ${challenge.name} challenge starts tomorrow (${formattedDate})!`;
      message += `\n\nPlease make sure to confirm your starting weight before the challenge begins.`;
      message += `\n\nGet ready to crush your daily step goal of ${challenge.stepGoal} steps!`;

      const botName = challenge.botName || 'Fitness Motivator';
      // Send as plain text message, not a card
      await sendMatrixMessage(
        challenge.matrixRoomId,
        message,
        challenge._id,
        botName
      );
    }
  } catch (err) {
    console.error('❌ Error sending challenge start reminders:', err.message);
  }
};

// Set up cron jobs
const setupCronJobs = () => {
  // Daily step updates at 12 PM (noon)
  cron.schedule('0 12 * * *', () => {
    console.log('📊 Running daily step update (noon)...');
    sendDailyStepUpdate();
  });

  // Daily step updates at 9 PM
  cron.schedule('0 21 * * *', () => {
    console.log('📊 Running daily step update (evening)...');
    sendDailyStepUpdate();
  });

  // Weigh-in reminders - check daily at 8 AM
  cron.schedule('0 8 * * *', () => {
    console.log('⚖️  Checking for weigh-in reminders...');
    sendWeighInReminder();
  });

  // Weight loss celebrations - check daily at 9 AM (after weigh-in day)
  cron.schedule('0 9 * * *', () => {
    console.log('🎉 Checking for weight loss celebrations...');
    checkWeightLossCelebrations();
  });

  // Challenge winner announcements - check daily at 10 AM
  cron.schedule('0 10 * * *', () => {
    console.log('🏆 Checking for challenge winners...');
    announceChallengeWinner();
  });

  // Challenge start reminders - check daily at 8 AM
  cron.schedule('0 8 * * *', () => {
    console.log('📅 Checking for challenge start reminders...');
    sendChallengeStartReminders();
  });

  // Check for new participants every 2 minutes (more frequent to catch new joins)
  setInterval(() => {
    checkNewParticipants();
  }, 2 * 60 * 1000);

  // Check for step point changes every 30 seconds
  setInterval(() => {
    checkStepPointChanges();
  }, 30 * 1000);

  console.log('✅ Cron jobs and monitoring intervals set up');
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  if (matrixClient) {
    try {
      await matrixClient.stopClient();
    } catch (err) {
      console.error('Error stopping Matrix client:', err.message);
    }
  }
  
  if (mongoConnected) {
    try {
      await mongoose.disconnect();
    } catch (err) {
      console.error('Error disconnecting MongoDB:', err.message);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

// Main startup
const start = async () => {
  try {
    console.log('🤖 Fitness Bot starting...');
    
    // Connect to MongoDB
    await connectMongo();
    
    // Connect to Matrix (may fail, but we continue anyway)
    let client = null;
    try {
      client = await connectMatrix();
    } catch (matrixErr) {
      console.error('⚠️  Unexpected error during Matrix connection:', matrixErr.message);
      client = null; // Continue without Matrix
    }
    
    // Set up cron jobs and monitoring
    setupCronJobs();
    
    // Initial checks
    checkNewParticipants();
    checkStepPointChanges();
    
    if (client) {
      console.log('🤖 Fitness Bot is running!');
    } else {
      console.log('🤖 Fitness Bot is running (Matrix connection failed, will retry periodically)...');
      
      // Set up periodic retry for Matrix connection (every 5 minutes)
      setInterval(async () => {
        if (!matrixConnected) {
          console.log('🔄 Attempting to reconnect to Matrix...');
          try {
            await connectMatrix();
            if (matrixConnected) {
              console.log('✅ Successfully reconnected to Matrix!');
            }
          } catch (err) {
            // Silently fail - will retry again later
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    
    console.log('✅ Bot process will stay alive. MongoDB:', mongoConnected ? 'connected' : 'disconnected', '| Matrix:', matrixConnected ? 'connected' : 'disconnected');
    
    // Keep process alive
    // The MongoDB connection and intervals will keep the event loop active
  } catch (err) {
    // Only exit if MongoDB fails (critical)
    if (!mongoConnected) {
      console.error('❌ Bot startup failed (MongoDB critical):', err.message);
      process.exit(1);
    } else {
      // MongoDB connected, Matrix failed - continue running
      console.error('⚠️  Bot started but Matrix connection failed. Bot will continue running.');
    }
  }
};

// Start the bot
start();
