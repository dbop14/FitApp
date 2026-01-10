const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');

// Script to add yesterday's step goal point for Dylan
async function addYesterdayStepPoint() {
  try {
    console.log('🔄 Adding yesterday\'s step goal point for Dylan...');
    
    const userId = '108452956929429773201'; // Dylan's Google ID
    const challengeId = '695aeac3f3d5d69eab7e9d3e'; // Challenge ID from logs
    
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
      weightLossPoints: participant.weightLossPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate
    });
    
    // Add the additional step goal point for yesterday
    participant.points += 1; // Total points: 2 + 1 = 3
    participant.stepGoalPoints += 1; // Step goal points: 1 + 1 = 2
    participant.stepGoalDaysAchieved += 1; // Days achieved: 1 + 1 = 2
    
    // Keep the lastStepDate as today since that's the most recent
    // The system tracks total days achieved, not specific dates
    
    await participant.save();
    
    console.log('✅ Successfully added yesterday\'s step goal point!');
    console.log('📊 Updated participant data:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      weightLossPoints: participant.weightLossPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate
    });
    
    console.log('🏆 Final point breakdown:');
    console.log(`  Weight Loss Points: ${participant.weightLossPoints} (1% loss)`);
    console.log(`  Step Goal Points: ${participant.stepGoalPoints} (2 days achieved)`);
    console.log(`  Total Points: ${participant.points}`);
    
  } catch (error) {
    console.error('❌ Error adding yesterday\'s step point:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await addYesterdayStepPoint();
    
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

module.exports = addYesterdayStepPoint;