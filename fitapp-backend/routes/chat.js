const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const { sendPushNotification } = require('./push');

// GET chat messages for a challenge
router.get('/:challengeId/messages', async (req, res) => {
  const { challengeId } = req.params;
  
  // Validate challengeId
  if (!challengeId || challengeId === 'undefined' || challengeId === 'null') {
    return res.status(400).json({ error: 'Invalid challenge ID' });
  }
  
  try {
    const messages = await ChatMessage.find({ challengeId })
      .sort({ timestamp: 1 })
      .limit(100); // Limit to last 100 messages
    
    // #region agent log
    const fs = require('fs');
    const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
    try {
      const cardMessages = messages.filter(m => m.messageType && m.messageType !== 'text');
      const logEntry = JSON.stringify({location:'fitapp-backend/routes/chat.js:20',message:'messages fetched from DB',data:{totalMessages:messages.length,cardMessages:cardMessages.length,cardTypes:cardMessages.map(m=>m.messageType),hasWelcomeCard:cardMessages.some(m=>m.messageType==='welcomeCard'),sampleMessage:cardMessages[0]?{messageType:cardMessages[0].messageType,hasCardData:!!cardMessages[0].cardData}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
    } catch(e) {}
    // #endregion
    
    res.json(messages);
  } catch (err) {
    console.error('❌ Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch chat messages', details: err.message });
  }
});

// POST a new chat message
router.post('/:challengeId/messages', async (req, res) => {
  const { challengeId } = req.params;
  const { sender, message, isBot = false, isSystem = false, isOwn = false, userId, userEmail } = req.body;
  
  // #region agent log
  const fs = require('fs');
  const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
  try {
    const logEntry = JSON.stringify({location:'chat.js:30',message:'POST message request',data:{challengeId,sender,hasUserId:!!userId,hasUserEmail:!!userEmail,userId,userEmail,isBot,isSystem},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch(e) {}
  // #endregion
  
  console.log('📝 Chat message request:', {
    challengeId,
    sender,
    message: message?.substring(0, 50) + '...',
    isBot,
    isSystem,
    isOwn,
    userId,
    userEmail
  });
  
  if (!sender || !message) {
    return res.status(400).json({ error: 'Missing required fields: sender and message' });
  }
  
  try {
    // For user messages, verify the user is a participant in this challenge
    if (!isBot && !isSystem && userId && userEmail) {
      console.log('🔍 Verifying user participation for:', { challengeId, userId, userEmail });
      
      // Check if user is a participant in this challenge
      const participant = await ChallengeParticipant.findOne({ 
        challengeId, 
        userId 
      });
      
      console.log('🔍 Participant check result:', participant ? 'Found' : 'Not found');
      
      if (!participant) {
        console.log('❌ User not a participant in challenge:', { challengeId, userId });
        return res.status(403).json({ 
          error: 'You are not a participant in this challenge' 
        });
      }
      
      // Verify the user exists in our database
      const user = await User.findOne({ googleId: userId });
      console.log('🔍 User verification result:', user ? 'Found' : 'Not found');
      
      if (!user) {
        console.log('❌ User not found in database:', { userId });
        return res.status(403).json({ 
          error: 'User not found in database' 
        });
      }
      
      // Use the verified user name from our database
      const verifiedSender = user.name || sender;
      
            const newMessage = new ChatMessage({
              challengeId,
              sender: verifiedSender,
              message,
              isBot,
              isSystem,
              isOwn,
              userId: userId,
              userPicture: user.picture,
              messageType: req.body.messageType || 'text', // Support card message types
              cardData: req.body.cardData || undefined, // Support card data
              imageUrl: req.body.imageUrl || undefined // Support image URLs
            });
      
      await newMessage.save();
      
      // #region agent log
      try {
        const logEntry = JSON.stringify({location:'chat.js:92',message:'message saved with userId',data:{messageId:newMessage._id,challengeId,sender:verifiedSender,userId:newMessage.userId,storedUserId:newMessage.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}) + '\n';
        fs.appendFileSync(logPath, logEntry);
      } catch(e) {}
      // #endregion
      
      console.log('✅ Chat message saved successfully:', { messageId: newMessage._id, challengeId, sender: verifiedSender, userId: newMessage.userId });
      
      // Send push notifications to all participants except the sender
      try {
        console.log('🔔 [PUSH DEBUG] Starting push notification for user message', { challengeId, sender: verifiedSender, userId });
        
        // #region agent log
        const fs = require('fs');
        const path = require('path');
        const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
        try {
          const logDir = path.dirname(logPath);
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          const logEntry = JSON.stringify({location:'chat.js:125',message:'Starting push notification for user message',data:{challengeId,sender:verifiedSender,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {
          console.error('❌ [PUSH DEBUG] Failed to write log:', e.message);
        }
        // #endregion
        
        const participants = await ChallengeParticipant.find({ challengeId });
        console.log(`📱 [PUSH DEBUG] Found ${participants.length} participant(s) for push notifications`);
        
        // #region agent log
        try {
          const participantIds = participants.map(p => p.userId);
          const logEntry = JSON.stringify({location:'chat.js:130',message:'Found participants for push',data:{challengeId,participantCount:participants.length,participantIds,currentUserId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {
          console.error('❌ [PUSH DEBUG] Failed to write participant log:', e.message);
        }
        // #endregion
        
        const notificationTitle = verifiedSender;
        const notificationBody = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        for (const participant of participants) {
          // Skip notification for the sender
          if (participant.userId !== userId) {
            console.log(`📤 [PUSH DEBUG] Sending push notification to participant: ${participant.userId}`);
            // #region agent log
            try {
              const logEntry = JSON.stringify({location:'chat.js:140',message:'Calling sendPushNotification',data:{targetUserId:participant.userId,title:notificationTitle,bodyLength:notificationBody.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
              fs.appendFileSync(logPath, logEntry);
            } catch(e) {
              console.error('❌ [PUSH DEBUG] Failed to write call log:', e.message);
            }
            // #endregion
            
            await sendPushNotification(
              participant.userId,
              notificationTitle,
              notificationBody,
              { challengeId }
            );
            
            console.log(`✅ [PUSH DEBUG] sendPushNotification completed for ${participant.userId}`);
            // #region agent log
            try {
              const logEntry = JSON.stringify({location:'chat.js:148',message:'sendPushNotification completed',data:{targetUserId:participant.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
              fs.appendFileSync(logPath, logEntry);
            } catch(e) {
              console.error('❌ [PUSH DEBUG] Failed to write completion log:', e.message);
            }
            // #endregion
          } else {
            console.log(`⏭️  [PUSH DEBUG] Skipping push notification for sender: ${participant.userId}`);
          }
        }
      } catch (pushError) {
        console.error('❌ Error sending push notifications:', pushError);
        // #region agent log
        const fs = require('fs');
        const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
        try {
          const logEntry = JSON.stringify({location:'chat.js:155',message:'Push notification error',data:{error:pushError.message,stack:pushError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
        // Don't fail the request if push notifications fail
      }
      
      res.status(201).json(newMessage);
    } else {
      console.log('🤖 Processing bot/system message or message without userId/userEmail');
      
      // #region agent log
      try {
        const logEntry = JSON.stringify({location:'chat.js:97',message:'processing message without userId',data:{challengeId,sender,hasUserId:!!userId,hasUserEmail:!!userEmail,isBot,isSystem,reason:!userId || !userEmail ? 'missing userId/userEmail' : 'bot/system'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}) + '\n';
        fs.appendFileSync(logPath, logEntry);
      } catch(e) {}
      // #endregion
      
      // For bot and system messages, no verification needed
      const newMessage = new ChatMessage({
        challengeId,
        sender,
        message,
        isBot,
        isSystem,
        isOwn,
        userId: userId || undefined, // Store userId if provided even for bot/system messages
        userPicture: req.body.userPicture || undefined,
        messageType: req.body.messageType || 'text', // Support card message types
        cardData: req.body.cardData || undefined, // Support card data
        imageUrl: req.body.imageUrl || undefined // Support image URLs
      });
      
      await newMessage.save();
      
      // #region agent log
      try {
        const logEntry = JSON.stringify({location:'chat.js:111',message:'bot/system message saved',data:{messageId:newMessage._id,challengeId,sender,storedUserId:newMessage.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}) + '\n';
        fs.appendFileSync(logPath, logEntry);
      } catch(e) {}
      // #endregion
      
      console.log('✅ Bot/system message saved successfully:', { messageId: newMessage._id, challengeId, sender, userId: newMessage.userId });
      
      // Send push notifications to all participants for bot/system messages
      try {
        console.log('🔔 [PUSH DEBUG] Starting push notification for bot message', { challengeId, sender, isBot, isSystem });
        
        // #region agent log
        const fs = require('fs');
        const path = require('path');
        const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
        try {
          const logDir = path.dirname(logPath);
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          const logEntry = JSON.stringify({location:'chat.js:181',message:'Starting push notification for bot message',data:{challengeId,sender,isBot,isSystem},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {
          console.error('❌ [PUSH DEBUG] Failed to write bot log:', e.message);
        }
        // #endregion
        
        const participants = await ChallengeParticipant.find({ challengeId });
        console.log(`📱 [PUSH DEBUG] Found ${participants.length} participant(s) for bot message push notifications`);
        
        // #region agent log
        try {
          const participantIds = participants.map(p => p.userId);
          const logEntry = JSON.stringify({location:'chat.js:187',message:'Found participants for bot push',data:{challengeId,participantCount:participants.length,participantIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
        
        const notificationTitle = sender;
        const notificationBody = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        for (const participant of participants) {
          console.log(`📤 [PUSH DEBUG] Sending bot push notification to participant: ${participant.userId}`);
          // #region agent log
          try {
            const logEntry = JSON.stringify({location:'chat.js:195',message:'Calling sendPushNotification for bot',data:{targetUserId:participant.userId,title:notificationTitle,bodyLength:notificationBody.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
            fs.appendFileSync(logPath, logEntry);
          } catch(e) {
            console.error('❌ [PUSH DEBUG] Failed to write bot call log:', e.message);
          }
          // #endregion
          
          await sendPushNotification(
            participant.userId,
            notificationTitle,
            notificationBody,
            { challengeId }
          );
          
          console.log(`✅ [PUSH DEBUG] sendPushNotification completed for bot to ${participant.userId}`);
          // #region agent log
          try {
            const logEntry = JSON.stringify({location:'chat.js:203',message:'sendPushNotification completed for bot',data:{targetUserId:participant.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
            fs.appendFileSync(logPath, logEntry);
          } catch(e) {
            console.error('❌ [PUSH DEBUG] Failed to write bot completion log:', e.message);
          }
          // #endregion
        }
      } catch (pushError) {
        console.error('❌ Error sending push notifications:', pushError);
        // #region agent log
        const fs = require('fs');
        const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
        try {
          const logEntry = JSON.stringify({location:'chat.js:210',message:'Bot push notification error',data:{error:pushError.message,stack:pushError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'push-missing'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
        // Don't fail the request if push notifications fail
      }
      
      res.status(201).json(newMessage);
    }
  } catch (err) {
    console.error('❌ Error creating chat message:', err);
    res.status(500).json({ error: 'Failed to create chat message', details: err.message });
  }
});

// POST a welcome message for a new participant
router.post('/:challengeId/welcome/:participantName', async (req, res) => {
  const { challengeId, participantName } = req.params;
  
  try {
    // Get challenge info for the welcome message
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    const botName = challenge.botName || 'Fitness Motivator';
    
    const welcomeMessage = new ChatMessage({
      challengeId,
      sender: botName,
      message: `Welcome ${participantName} to the ${challenge.name} challenge! 💪 Let's crush those fitness goals together!`,
      isBot: true,
      timestamp: new Date()
    });
    
    await welcomeMessage.save();
    
    console.log(`✅ Added welcome message for ${participantName} in challenge ${challenge.name}`);
    
    res.status(201).json(welcomeMessage);
  } catch (err) {
    console.error('Error creating welcome message:', err);
    res.status(500).json({ error: 'Failed to create welcome message', details: err.message });
  }
});

module.exports = router; 