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
      
      console.log('✅ Chat message saved successfully:', { messageId: newMessage._id, challengeId, sender: verifiedSender, userId: newMessage.userId });
      
      // Send push notifications to all participants except the sender
      try {
        const participants = await ChallengeParticipant.find({ challengeId });
        
        const notificationTitle = verifiedSender;
        const notificationBody = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        for (const participant of participants) {
          // Skip notification for the sender
          if (participant.userId !== userId) {
            await sendPushNotification(
              participant.userId,
              notificationTitle,
              notificationBody,
              { challengeId }
            );
          }
        }
      } catch (pushError) {
        console.error('❌ Error sending push notifications:', pushError);
        // Don't fail the request if push notifications fail
      }
      
      res.status(201).json(newMessage);
    } else {
      console.log('🤖 Processing bot/system message or message without userId/userEmail');
      
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
      
      console.log('✅ Bot/system message saved successfully:', { messageId: newMessage._id, challengeId, sender, userId: newMessage.userId });
      
      // Send push notifications to all participants for bot/system messages
      try {
        const participants = await ChallengeParticipant.find({ challengeId });
        
        const notificationTitle = sender;
        const notificationBody = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        for (const participant of participants) {
          await sendPushNotification(
            participant.userId,
            notificationTitle,
            notificationBody,
            { challengeId }
          );
        }
      } catch (pushError) {
        console.error('❌ Error sending push notifications:', pushError);
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