const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to test and verify the points workflow
async function testPointsWorkflow() {
  try {
    console.log('🧪 Testing Points Workflow for Dylan...');
    
    const userId = '105044462574652357380'; // Dylan's Google ID
    const challengeId = '6896b45176d78ebc85d22bf7'; // Challenge ID
    
    // Get current state
    const participant = await ChallengeParticipant.findOne({ 
      userId: userId, 
      challengeId: challengeId 
    });
    
    const user = await User.findOne({ googleId: userId });
    const challenge = await Challenge.findById(challengeId);
    
    console.log('📊 Current State:');
    console.log('User:', {
      name: user?.name,
      email: user?.email,
      steps: user?.steps,
      weight: user?.weight
    });
    
    console.log('Challenge:', {
      name: challenge?.name,
      stepGoal: challenge?.stepGoal
    });
    
    console.log('Participant:', {
      totalPoints: participant?.points,
      stepGoalPoints: participant?.stepGoalPoints,
      weightLossPoints: participant?.weightLossPoints,
      stepGoalDaysAchieved: participant?.stepGoalDaysAchieved,
      lastStepCount: participant?.lastStepCount,
      lastStepDate: participant?.lastStepDate,
      startingWeight: participant?.startingWeight,
      lastWeight: participant?.lastWeight
    });
    
    // Test additive logic
    console.log('\n🧮 Testing Additive Logic:');
    
    // Test 1: What happens if we add another step goal point?
    const currentStepPoints = participant?.stepGoalPoints || 0;
    const currentDaysAchieved = participant?.stepGoalDaysAchieved || 0;
    const currentTotalPoints = participant?.points || 0;
    
    console.log(`Current step goal points: ${currentStepPoints}`);
    console.log(`Current days achieved: ${currentDaysAchieved}`);
    console.log(`Current total points: ${currentTotalPoints}`);
    
    console.log('\n✅ If Dylan earns another step goal point:');
    console.log(`New step goal points would be: ${currentStepPoints + 1}`);
    console.log(`New days achieved would be: ${currentDaysAchieved + 1}`);
    console.log(`New total points would be: ${currentTotalPoints + 1}`);
    
    // Test 2: Weight loss calculation
    if (participant?.startingWeight && participant?.lastWeight) {
      const weightLoss = participant.startingWeight - participant.lastWeight;
      const percentLoss = (weightLoss / participant.startingWeight) * 100;
      const expectedWeightPoints = Math.floor(percentLoss);
      
      console.log('\n⚖️ Weight Loss Analysis:');
      console.log(`Starting weight: ${participant.startingWeight} lbs`);
      console.log(`Current weight: ${participant.lastWeight} lbs`);
      console.log(`Weight lost: ${weightLoss} lbs`);
      console.log(`Percentage lost: ${percentLoss.toFixed(2)}%`);
      console.log(`Expected weight loss points: ${expectedWeightPoints}`);
      console.log(`Actual weight loss points: ${participant.weightLossPoints}`);
      
      if (participant.weightLossPoints !== expectedWeightPoints) {
        console.log('⚠️ MISMATCH: Weight loss points don\'t match expected calculation!');
      } else {
        console.log('✅ Weight loss points are correct');
      }
    }
    
    // Test 3: Point accumulation logic
    console.log('\n🔢 Point Accumulation Test:');
    const expectedTotal = (participant?.stepGoalPoints || 0) + (participant?.weightLossPoints || 0);
    console.log(`Step goal points: ${participant?.stepGoalPoints || 0}`);
    console.log(`Weight loss points: ${participant?.weightLossPoints || 0}`);
    console.log(`Expected total: ${expectedTotal}`);
    console.log(`Actual total: ${participant?.points || 0}`);
    
    if (participant?.points === expectedTotal) {
      console.log('✅ Point totals are consistent');
    } else {
      console.log('⚠️ MISMATCH: Total points don\'t match sum of individual categories!');
      console.log(`Discrepancy: ${(participant?.points || 0) - expectedTotal} points`);
    }
    
    // Test 4: Daily limit check
    console.log('\n📅 Daily Limit Test:');
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const lastStepDate = participant?.lastStepDate ? new Date(participant.lastStepDate) : null;
    let lastStepDateNormalized = null;
    if (lastStepDate) {
      lastStepDateNormalized = new Date(lastStepDate);
      lastStepDateNormalized.setHours(0,0,0,0);
    }
    
    const alreadyGotStepPoint = lastStepDateNormalized && lastStepDateNormalized.getTime() === today.getTime();
    
    console.log(`Today: ${today.toISOString()}`);
    console.log(`Last step date: ${lastStepDate?.toISOString()}`);
    console.log(`Last step date normalized: ${lastStepDateNormalized?.toISOString()}`);
    console.log(`Already got step point today: ${alreadyGotStepPoint}`);
    
    if (user?.steps >= challenge?.stepGoal) {
      if (alreadyGotStepPoint) {
        console.log('✅ Step goal reached but point already awarded - daily limit working correctly');
      } else {
        console.log('🏆 Step goal reached and point can be awarded');
      }
    } else {
      console.log(`📊 Step goal not reached: ${user?.steps} < ${challenge?.stepGoal}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing points workflow:', error);
  }
}

// Connect to MongoDB and run the test
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await testPointsWorkflow();
    
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

module.exports = testPointsWorkflow;