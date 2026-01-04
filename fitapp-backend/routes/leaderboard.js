const express = require('express');
const router = express.Router();
const ChallengeParticipant = require('../models/ChallengeParticipant');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const FitnessHistory = require('../models/FitnessHistory');

// GET leaderboard for a challenge
router.get('/:challengeId', async (req, res) => {
  const { challengeId } = req.params;
  try {
    // Get all participants for this challenge
    // We'll calculate final points and sort after processing
    const participants = await ChallengeParticipant.find({ challengeId });

    console.log(`🔍 Found ${participants.length} participants for challenge ${challengeId}`);

    // Fetch user info for each participant
    const userIds = participants.map(p => p.userId);
    console.log(`🔍 Looking up users with IDs:`, userIds);
    
    const users = await User.find({ googleId: { $in: userIds } });
    console.log(`🔍 Found ${users.length} users in database`);
    
    const userMap = {};
    users.forEach(u => { userMap[u.googleId] = u; });

    // Get challenge to check if it's ended and get step goal
    const challenge = await Challenge.findById(challengeId);
    const challengeEnded = challenge && challenge.endDate ? new Date() >= new Date(challenge.endDate) : false;
    
    // Helper function for weight loss points rounding
    const roundWeightLossPoints = (percentage) => {
      const decimal = percentage % 1;
      if (decimal >= 0.5) {
        return Math.ceil(percentage);
      } else {
        return Math.floor(percentage);
      }
    };
    
    // Combine participant and user info, calculate ranks
    // Handle ties: participants with the same points get the same rank
    let currentRank = 1;
    let previousPoints = null;
    
    // Pre-fetch all FitnessHistory entries for all participants to avoid N+1 queries
    const participantUserIds = participants.map(p => p.userId);
    const fitnessHistoryEntries = await FitnessHistory.find({
      userId: { $in: participantUserIds },
      weight: { $ne: null }
    }).sort({ userId: 1, date: -1 });
    
    // Create a map of most recent weight per user
    const mostRecentWeightMap = {};
    fitnessHistoryEntries.forEach(entry => {
      if (!mostRecentWeightMap[entry.userId] || entry.date > mostRecentWeightMap[entry.userId].date) {
        mostRecentWeightMap[entry.userId] = entry;
      }
    });
    
    const leaderboard = participants.map((p, index) => {
      const user = userMap[p.userId];
      
      // Always start with step points (these are earned during the challenge)
      const stepPoints = p.stepGoalPoints || 0;
      let weightLossPoints = p.weightLossPoints || 0;
      
      // Get the most recent weight from FitnessHistory if available
      const mostRecentWeightEntry = mostRecentWeightMap[p.userId];
      let effectiveLastWeight = p.lastWeight;
      
      if (mostRecentWeightEntry && mostRecentWeightEntry.weight) {
        effectiveLastWeight = mostRecentWeightEntry.weight;
      }
      
      // Calculate weight loss points if we have weight data (use most recent weight - users don't need to weigh in daily)
      // If lastWeight is null/undefined, use startingWeight (meaning 0% loss until they weigh in)
      if (p.startingWeight) {
        // Use effectiveLastWeight (from FitnessHistory if available, otherwise participant.lastWeight)
        const weightToUse = effectiveLastWeight !== undefined && effectiveLastWeight !== null ? effectiveLastWeight : p.startingWeight;
        
        const totalWeightLost = p.startingWeight - weightToUse;
        const totalPercentLost = Math.max(0, (totalWeightLost / p.startingWeight) * 100);
        const calculatedWeightLossPoints = roundWeightLossPoints(totalPercentLost);
        
        // Update stored weightLossPoints if different (for consistency)
        if (p.weightLossPoints !== calculatedWeightLossPoints) {
          weightLossPoints = calculatedWeightLossPoints;
          p.weightLossPoints = calculatedWeightLossPoints;
          // Also update total points when weight loss points change
          const stepPoints = p.stepGoalPoints || 0;
          p.points = stepPoints + calculatedWeightLossPoints;
          p.save().catch(err => console.error('Error updating weightLossPoints:', err));
        } else {
          weightLossPoints = calculatedWeightLossPoints;
        }
        
        // Ensure lastWeight is set if it was null (use startingWeight as default)
        if (p.lastWeight === undefined || p.lastWeight === null) {
          p.lastWeight = p.startingWeight;
          p.save().catch(err => console.error('Error updating lastWeight:', err));
        }
      }
      
      // Total points = step points + weight loss points (always included)
      const finalPoints = stepPoints + weightLossPoints;
      
      console.log(`📊 ${user?.name || p.userId} - ${stepPoints} step points + ${weightLossPoints} weight loss = ${finalPoints} total`);
      
      // Check if step goal is achieved today
      const stepGoalMet = challenge && user?.steps && (user.steps >= challenge.stepGoal);
      const stepGoalAchieved = stepGoalMet || false;
      
      // Calculate rank - if points are different from previous, update rank
      // If points are the same, keep the same rank (ties)
      if (previousPoints !== null && finalPoints !== previousPoints) {
        currentRank = index + 1;
      } else if (previousPoints === null) {
        currentRank = 1;
      }
      // If points are the same as previous, currentRank stays the same
      
      previousPoints = finalPoints;
      
      // Debug profile picture data
      console.log(`🖼️ Backend profile picture for ${user?.name || 'Unknown'}:`, {
        userId: p.userId,
        userName: user?.name,
        userEmail: user?.email,
        userPicture: user?.picture,
        hasPicture: !!user?.picture,
        userFound: !!user
      });
      
      return {
        userId: p.userId,
        name: user?.name || 'Unknown User',
        email: user?.email || '',
        picture: user?.picture || null, // Include profile picture
        rank: currentRank, // Add rank field
        points: finalPoints, // Final calculated points
        totalPoints: finalPoints, // Alias for compatibility
        stepGoalPoints: p.stepGoalPoints || 0,
        weightLossPoints: weightLossPoints,
        stepGoalDaysAchieved: p.stepGoalDaysAchieved || 0,
        startingWeight: p.startingWeight,
        lastWeight: effectiveLastWeight !== undefined && effectiveLastWeight !== null ? effectiveLastWeight : p.startingWeight, // Use FitnessHistory weight if available, otherwise participant.lastWeight, fallback to startingWeight
        lastStepDate: p.lastStepDate,
        lastStepCount: p.lastStepCount,
        stepGoalAchieved: stepGoalAchieved, // Whether step goal is currently met
        stepGoal: challenge?.stepGoal || 0,
        currentSteps: user?.steps || 0,
      };
    });

    // Sort leaderboard by final points (descending), then by name for ties
    leaderboard.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points; // Higher points first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    });
    
    // Recalculate ranks after sorting
    leaderboard.forEach((entry, index) => {
      if (index === 0 || entry.points !== leaderboard[index - 1].points) {
        entry.rank = index + 1;
      } else {
        entry.rank = leaderboard[index - 1].rank; // Same rank for ties
      }
    });
    
    console.log(`📊 Returning leaderboard with ${leaderboard.length} entries`);
    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: err.message });
  }
});

// POST to add a participant to a challenge
router.post('/:challengeId/participants', async (req, res) => {
  const { challengeId } = req.params;
  const { userId, email, name, startingWeight = 154, picture } = req.body;

  // Validate required fields
  if (!userId || !email || !name) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, email, and name are required' 
    });
  }

  // Validate Google ID format (should be a valid string)
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({ 
      error: 'Invalid Google ID: must be a valid string' 
    });
  }

  // Convert challengeId to string for consistency
  // Ensure it's the string representation of the ObjectId
  let challengeIdStr = String(challengeId);
  // If it's a valid ObjectId, ensure we use the canonical string format
  const mongoose = require('mongoose');
  if (mongoose.Types.ObjectId.isValid(challengeIdStr)) {
    // Normalize to ensure consistent format
    challengeIdStr = new mongoose.Types.ObjectId(challengeIdStr).toString();
  }

  try {
    // First, verify the challenge exists
    const challenge = await Challenge.findById(challengeIdStr);
    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        details: `No challenge exists with ID: ${challengeIdStr}`
      });
    }

    // Check if participant already exists
    const existingParticipant = await ChallengeParticipant.findOne({ 
      challengeId: challengeIdStr, 
      userId 
    });

    if (existingParticipant) {
      return res.status(400).json({ 
        error: 'User is already a participant in this challenge' 
      });
    }

    // Verify user exists or create with valid Google ID
    let user = await User.findOne({ googleId: userId });
    if (!user) {
      // Only create user if we have a valid Google ID
      if (userId && userId.trim().length > 0) {
        user = new User({
          googleId: userId,
          name: name,
          email: email,
          picture: picture || null, // Include profile picture if provided
          steps: 0,
          weight: startingWeight,
          lastSync: new Date()
        });
        await user.save();
        console.log(`✅ Created new user: ${email} (${userId}) with picture: ${picture ? 'yes' : 'no'}`);
      } else {
        return res.status(400).json({ 
          error: 'Invalid Google ID: cannot create user without valid Google ID' 
        });
      }
    } else {
      // Update existing user info, including picture if provided
      user.name = name;
      user.email = email;
      if (picture) {
        user.picture = picture; // Update picture if provided
      }
      await user.save();
      console.log(`✅ Updated existing user: ${email} (${userId}) with picture: ${picture ? 'yes' : 'no'}`);
    }

    // Check if challenge starts in the future (challenge already fetched above on line 214)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const challengeStart = challenge.startDate ? new Date(challenge.startDate) : null;
    if (challengeStart) {
      challengeStart.setHours(0, 0, 0, 0);
    }
    const isFutureChallenge = challengeStart && challengeStart > today;
    
    // For ALL challenges (future or current), startingWeight should be null until confirmed on first weigh-in day
    // Only set lastWeight if we have a value (for display purposes), but startingWeight stays null
    const validStartingWeight = null; // Always null until confirmed on first weigh-in day
    
    // Get lastWeight from provided startingWeight or user's current weight, or null
    let validLastWeight = null;
    if (startingWeight && !isNaN(parseFloat(startingWeight))) {
      validLastWeight = parseFloat(startingWeight);
    } else if (user && user.weight) {
      validLastWeight = user.weight;
    }

    // Create new participant
    const newParticipant = new ChallengeParticipant({
      challengeId: challengeIdStr,
      userId,
      startingWeight: validStartingWeight, // Always null until confirmed on first weigh-in day
      lastWeight: validLastWeight, // Can be set for display, but startingWeight stays null
      points: 0,
      stepGoalPoints: 0,
      weightLossPoints: 0,
      stepGoalDaysAchieved: 0,
      lastStepDate: null,
      lastStepCount: 0
    });

    await newParticipant.save();
    console.log(`✅ Created ChallengeParticipant record for ${email} in challenge ${challengeIdStr}`);

    // Update the Challenge model's participants array
    if (!challenge.participants.includes(email)) {
      challenge.participants.push(email);
      await challenge.save();
      console.log(`✅ Updated challenge participants array for: ${email}`);
    }

    console.log(`✅ Added participant to challenge: ${email} (${userId})`);

    // Note: Welcome card messages are now handled by the fitapp-bot service
    // The bot will detect new participants and send a welcomeCard automatically
    // This prevents duplicate messages and ensures consistent card formatting

    res.status(201).json({
      message: 'Participant added successfully',
      participant: {
        userId,
        name,
        email,
        picture: user.picture, // Include picture in response
        startingWeight,
        points: 0
      }
    });

  } catch (err) {
    console.error('Error adding participant:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to add participant', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// DELETE to remove a participant from a challenge (leave challenge)
router.delete('/:challengeId/participants/:userId', async (req, res) => {
  const { challengeId, userId } = req.params;

  console.log(`🚪 User ${userId} attempting to leave challenge ${challengeId}`);

  try {
    // Get the challenge to check if user is admin
    const Challenge = require('../models/Challenge');
    const challenge = await Challenge.findById(challengeId);
    
    if (!challenge) {
      console.log(`❌ Challenge ${challengeId} not found`);
      return res.status(404).json({ 
        error: 'Challenge not found',
        details: `No challenge exists with ID: ${challengeId}`
      });
    }

    console.log(`✅ Found challenge: "${challenge.name}" (admin: ${challenge.admin})`);

    // Check if user is the admin (admin cannot leave)
    if (challenge.admin === userId) {
      console.log(`❌ Admin ${userId} cannot leave challenge - must delete instead`);
      return res.status(403).json({ 
        error: 'Challenge admin cannot leave the challenge. Please transfer admin rights or delete the challenge instead.' 
      });
    }

    // Find the participant record
    const participant = await ChallengeParticipant.findOne({ challengeId, userId });
    
    if (!participant) {
      console.log(`❌ No participant record found for user ${userId} in challenge ${challengeId}`);
      
      // Check if user exists in challenge participants array (data inconsistency)
      const user = await User.findOne({ googleId: userId });
      const userEmail = user?.email;
      
      if (userEmail && challenge.participants.includes(userEmail)) {
        console.log(`🔧 Found user in participants array but no ChallengeParticipant record - cleaning up`);
        challenge.participants = challenge.participants.filter(email => email !== userEmail);
        await challenge.save();
        console.log(`✅ Removed ${userEmail} from challenge participants array`);
        
        return res.json({ 
          message: 'User removed from challenge (cleaned up inconsistent data)',
          userName: user?.name,
          userEmail: userEmail
        });
      }
      
      return res.status(404).json({ 
        error: 'Participant not found in this challenge',
        details: `User ${userId} is not a participant in challenge ${challengeId}`
      });
    }

    // Get user info for the response
    const user = await User.findOne({ googleId: userId });
    const userName = user?.name || 'Unknown User';
    const userEmail = user?.email || '';

    console.log(`👤 Removing participant: ${userName} (${userEmail}) with ${participant.points} points`);

    // Remove participant record
    await ChallengeParticipant.findByIdAndDelete(participant._id);
    console.log(`✅ Deleted ChallengeParticipant record for ${userName}`);

    // Update challenge participants array
    if (challenge.participants.includes(userEmail)) {
      challenge.participants = challenge.participants.filter(email => email !== userEmail);
      await challenge.save();
      console.log(`✅ Updated challenge participants array, removed: ${userEmail}`);
    } else {
      console.log(`⚠️ User ${userEmail} was not in challenge participants array`);
    }

    // Add leave message to chat (plain text, not a card)
    try {
      const botName = challenge.botName || 'Fitness Motivator';
      const leaveMessageText = `${userName} has left the ${challenge.name} challenge. We'll miss you!`;
      
      const leaveMessage = new ChatMessage({
        challengeId,
        sender: botName,
        message: leaveMessageText,
        messageType: 'text',
        isBot: true,
        timestamp: new Date()
      });
      
      await leaveMessage.save();
      console.log(`✅ Added leave message for ${userName} in challenge ${challenge.name}`);
    } catch (chatErr) {
      console.error('Error adding leave message:', chatErr);
      // Don't fail the participant removal if leave message fails
    }

    res.json({
      message: 'Successfully left the challenge',
      participant: {
        userId,
        name: userName,
        email: userEmail
      }
    });

  } catch (err) {
    console.error('Error leaving challenge:', err);
    res.status(500).json({ error: 'Failed to leave challenge', details: err.message });
  }
});

module.exports = router;
