const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');

// Script to manually add a step goal point to a specific user
async function addStepPoint() {
  try {
    console.log('🔄 Adding step goal point for Dylan...');
    
    const userId = '105044462574652357380'; // Dylan's Google ID
    const challengeId = '6896b45176d78ebc85d22bf7'; // Challenge ID from logs
    
    // Find the participant record
    const participant = await ChallengeParticipant.findOne({ 
      userId: userId, 
      challengeId: challengeId 
    });
    
    if (!participant) {
      console.log('❌ Participant record not found');
      return;
    }
    
    console.log('📊 Current participant data:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate
    });
    
    // Add the point
    participant.points += 1;
    participant.stepGoalPoints = (participant.stepGoalPoints || 0) + 1;
    participant.stepGoalDaysAchieved = (participant.stepGoalDaysAchieved || 0) + 1;
    
    // Set the step date to today to maintain consistency
    const today = new Date();
    today.setHours(0,0,0,0);
    participant.lastStepDate = today;
    participant.lastStepCount = 6684; // Set to actual step count
    
    await participant.save();
    
    console.log('✅ Successfully added step goal point!');
    console.log('📊 Updated participant data:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate
    });
    
  } catch (error) {
    console.error('❌ Error adding step point:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await addStepPoint();
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = addStepPoint;