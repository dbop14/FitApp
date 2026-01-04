const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to inspect Dylan's participant data and understand the 602 points
async function inspectParticipant() {
  try {
    console.log('🔍 Inspecting participant data for Dylan...');
    
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
    
    // Get user record
    const user = await User.findOne({ googleId: userId });
    
    // Get challenge record
    const challenge = await Challenge.findById(challengeId);
    
    console.log('👤 User data:', {
      name: user?.name,
      email: user?.email,
      currentSteps: user?.steps,
      currentWeight: user?.weight,
      lastSync: user?.lastSync
    });
    
    console.log('🏆 Challenge data:', {
      name: challenge?.name,
      stepGoal: challenge?.stepGoal,
      startDate: challenge?.startDate,
      endDate: challenge?.endDate
    });
    
    console.log('📊 Participant data:', {
      challengeId: participant.challengeId,
      userId: participant.userId,
      startingWeight: participant.startingWeight,
      lastWeight: participant.lastWeight,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate,
      totalPoints: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      weightLossPoints: participant.weightLossPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved
    });
    
    // Calculate what the points should be
    let expectedWeightLossPoints = 0;
    if (participant.startingWeight && participant.lastWeight) {
      const percentLost = ((participant.startingWeight - participant.lastWeight) / participant.startingWeight) * 100;
      expectedWeightLossPoints = Math.floor(percentLost);
    }
    
    console.log('🧮 Point Analysis:');
    console.log(`  Starting Weight: ${participant.startingWeight} lbs`);
    console.log(`  Current Weight: ${participant.lastWeight} lbs`);
    console.log(`  Weight Lost: ${participant.startingWeight - participant.lastWeight} lbs`);
    console.log(`  Percentage Lost: ${((participant.startingWeight - participant.lastWeight) / participant.startingWeight * 100).toFixed(2)}%`);
    console.log(`  Expected Weight Loss Points: ${expectedWeightLossPoints}`);
    console.log(`  Actual Weight Loss Points: ${participant.weightLossPoints || 'undefined'}`);
    console.log(`  Expected Step Goal Points: ${participant.stepGoalPoints || 0}`);
    console.log(`  Total Expected Points: ${expectedWeightLossPoints + (participant.stepGoalPoints || 0)}`);
    console.log(`  Actual Total Points: ${participant.points}`);
    console.log(`  DISCREPANCY: ${participant.points - (expectedWeightLossPoints + (participant.stepGoalPoints || 0))} points`);
    
    // Check if there might be an issue with the calculation
    if (participant.points > 100) {
      console.log('⚠️  WARNING: Points seem unusually high! This might indicate:');
      console.log('    1. Bug in weight loss calculation logic');
      console.log('    2. Incorrect starting weight');
      console.log('    3. Data corruption');
      console.log('    4. Multiple point awards for the same achievement');
    }
    
  } catch (error) {
    console.error('❌ Error inspecting participant:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await inspectParticipant();
    
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

module.exports = inspectParticipant;