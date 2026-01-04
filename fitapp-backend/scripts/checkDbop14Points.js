const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to check current points status for dbop14
async function checkDbop14Points() {
  try {
    console.log('🔍 Checking current points status for dbop14...');
    
    // Find dbop14 by email
    const user = await User.findOne({ email: 'dbop14@gmail.com' });
    
    if (!user) {
      console.log('❌ User dbop14@gmail.com not found');
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
        stepGoalPoints: participant.stepGoalPoints || 0,
        weightLossPoints: participant.weightLossPoints || 0,
        stepGoalDaysAchieved: participant.stepGoalDaysAchieved || 0
      });
      
      // Calculate what the points should be
      let expectedWeightLossPoints = 0;
      if (participant.startingWeight && participant.lastWeight) {
        const percentLost = ((participant.startingWeight - participant.lastWeight) / participant.startingWeight) * 100;
        expectedWeightLossPoints = Math.floor(percentLost);
      }
      
      const expectedTotal = expectedWeightLossPoints + (participant.stepGoalPoints || 0);
      
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
      console.log(`  Total Expected Points: ${expectedTotal}`);
      console.log(`  Actual Total Points: ${participant.points}`);
      console.log(`  DISCREPANCY: ${participant.points - expectedTotal} points`);
      
      // Check for issues
      if (participant.points !== expectedTotal) {
        console.log('⚠️  POINTS MISMATCH DETECTED!');
        if (participant.weightLossPoints !== expectedWeightLossPoints) {
          console.log(`    Weight loss points mismatch: expected ${expectedWeightLossPoints}, got ${participant.weightLossPoints}`);
        }
        if (participant.stepGoalPoints !== (participant.stepGoalPoints || 0)) {
          console.log(`    Step goal points mismatch: expected ${participant.stepGoalPoints || 0}, got ${participant.stepGoalPoints}`);
        }
      }
      
      // Check if there might be an issue with the calculation
      if (participant.points > 100) {
        console.log('⚠️  WARNING: Points seem unusually high! This might indicate:');
        console.log('    1. Bug in weight loss calculation logic');
        console.log('    2. Incorrect starting weight');
        console.log('    3. Data corruption');
        console.log('    4. Multiple point awards for the same achievement');
        console.log('    5. Points being added multiple times');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    const totalPoints = participants.reduce((sum, p) => sum + p.points, 0);
    console.log(`  Total points across all challenges: ${totalPoints}`);
    
    if (totalPoints > 100) {
      console.log('🚨 CRITICAL: Total points are extremely high!');
      console.log('    This suggests there are serious issues with the points system.');
    }
    
  } catch (error) {
    console.error('❌ Error checking dbop14 points:', error);
  }
}

// Run the script
checkDbop14Points()
  .then(() => {
    console.log('✅ Points check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

