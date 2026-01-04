const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');

async function fixDbop1414Points() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔧 Fixing dbop1414 step points...');
    
    const participant = await ChallengeParticipant.findOne({
      userId: '117500098485701316317',
      challengeId: '6896b45176d78ebc85d22bf7'
    });
    
    if (!participant) {
      console.log('❌ Participant not found');
      return;
    }
    
    console.log('🔍 Current state:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints || 0,
      lastStepDate: participant.lastStepDate,
      lastStepCount: participant.lastStepCount
    });
    
    // Reset lastStepDate to yesterday so they can get today's point
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    participant.lastStepDate = yesterday;
    await participant.save();
    
    console.log('✅ Reset lastStepDate to yesterday:', yesterday);
    console.log('🎯 Now they can earn today\'s step point!');
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

fixDbop1414Points();