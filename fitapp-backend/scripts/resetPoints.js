const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');

// Script to reset Dylan's points to the correct values
async function resetPoints() {
  try {
    console.log('🔄 Resetting points for Dylan...');
    
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
      startingWeight: participant.startingWeight,
      lastWeight: participant.lastWeight,
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      weightLossPoints: participant.weightLossPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount
    });
    
    // Calculate correct points
    const startingWeight = 200; // Set correct starting weight
    const currentWeight = 198; // Current weight from logs
    const weightLossPercent = Math.floor(((startingWeight - currentWeight) / startingWeight) * 100);
    const correctWeightLossPoints = weightLossPercent; // 1% = 1 point
    const correctStepGoalPoints = 1; // Dylan reached his step goal
    const correctTotalPoints = correctWeightLossPoints + correctStepGoalPoints;
    
    console.log('🧮 Calculating correct points:');
    console.log(`  Starting Weight: ${startingWeight} lbs`);
    console.log(`  Current Weight: ${currentWeight} lbs`);
    console.log(`  Weight Loss: ${startingWeight - currentWeight} lbs`);
    console.log(`  Weight Loss %: ${weightLossPercent}%`);
    console.log(`  Correct Weight Loss Points: ${correctWeightLossPoints}`);
    console.log(`  Correct Step Goal Points: ${correctStepGoalPoints}`);
    console.log(`  Correct Total Points: ${correctTotalPoints}`);
    
    // Update the participant record with correct values
    participant.startingWeight = startingWeight;
    participant.lastWeight = currentWeight;
    participant.points = correctTotalPoints;
    participant.stepGoalPoints = correctStepGoalPoints;
    participant.weightLossPoints = correctWeightLossPoints;
    participant.stepGoalDaysAchieved = 1; // Dylan achieved step goal once
    participant.lastStepCount = 6684; // Set to actual step count from logs
    
    // Set last step date to today to maintain consistency
    const today = new Date();
    today.setHours(0,0,0,0);
    participant.lastStepDate = today;
    
    await participant.save();
    
    console.log('✅ Successfully reset points!');
    console.log('📊 Updated participant data:', {
      startingWeight: participant.startingWeight,
      lastWeight: participant.lastWeight,
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      weightLossPoints: participant.weightLossPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
      lastStepCount: participant.lastStepCount,
      lastStepDate: participant.lastStepDate
    });
    
  } catch (error) {
    console.error('❌ Error resetting points:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await resetPoints();
    
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

module.exports = resetPoints;