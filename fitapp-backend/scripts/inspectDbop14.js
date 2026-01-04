const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to inspect dbop14's participant data and understand the 1304 points issue
async function inspectDbop14() {
  try {
    console.log('🔍 Inspecting participant data for dbop14...');
    
    // Find dbop14 by email
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    
    if (!user) {
      console.log('❌ User dbop1414@gmail.com not found');
      return;
    }
    
    console.log('👤 User data:', {
      name: user.name,
      email: user.email,
      googleId: user.googleId,
      currentSteps: user.steps,
      currentWeight: user.weight,
      lastSync: user.lastSync
    });
    
    // Find all participant records for dbop14
    const participants = await ChallengeParticipant.find({ userId: user.googleId });
    
    console.log(`📊 Found ${participants.length} participant record(s) for dbop14:`);
    
    for (const participant of participants) {
      console.log('\n' + '='.repeat(60));
      
      // Get challenge record
      const challenge = await Challenge.findById(participant.challengeId);
      
      console.log('🏆 Challenge:', {
        name: challenge?.name || 'Unknown',
        challengeId: participant.challengeId,
        stepGoal: challenge?.stepGoal || 'Unknown',
        startDate: challenge?.startDate,
        endDate: challenge?.endDate
      });
      
      console.log('📊 Participant data:', {
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
      if (participant.startingWeight && participant.lastWeight) {
        console.log(`  Weight Lost: ${participant.startingWeight - participant.lastWeight} lbs`);
        console.log(`  Percentage Lost: ${((participant.startingWeight - participant.lastWeight) / participant.startingWeight * 100).toFixed(2)}%`);
      }
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
        console.log('    5. Points being added multiple times');
      }
      
      // Check for potential data corruption
      if (participant.weightLossPoints && participant.weightLossPoints > 1000) {
        console.log('🚨 CRITICAL: Weight loss points are extremely high!');
        console.log('    This suggests the weight loss calculation is broken or data is corrupted.');
      }
      
      if (participant.stepGoalPoints && participant.stepGoalPoints > 100) {
        console.log('🚨 CRITICAL: Step goal points are extremely high!');
        console.log('    This suggests step points are being awarded multiple times.');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    const totalPoints = participants.reduce((sum, p) => sum + p.points, 0);
    console.log(`  Total points across all challenges: ${totalPoints}`);
    console.log(`  Expected total points: ${participants.reduce((sum, p) => {
      let expectedWeightLoss = 0;
      if (p.startingWeight && p.lastWeight) {
        const percentLost = ((p.startingWeight - p.lastWeight) / p.startingWeight) * 100;
        expectedWeightLoss = Math.floor(percentLost);
      }
      return sum + expectedWeightLoss + (p.stepGoalPoints || 0);
    }, 0)}`);
    
  } catch (error) {
    console.error('❌ Error inspecting dbop14:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await inspectDbop14();
    
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

module.exports = inspectDbop14; 