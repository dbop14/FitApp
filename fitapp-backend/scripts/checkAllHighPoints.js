const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to check for any users with unusually high point values
async function checkAllHighPoints() {
  try {
    console.log('🔍 Checking for users with unusually high point values...');
    
    // Find all participants with more than 100 points
    const highPointParticipants = await ChallengeParticipant.find({ points: { $gt: 100 } });
    
    if (highPointParticipants.length === 0) {
      console.log('✅ No participants found with more than 100 points');
      return;
    }
    
    console.log(`🚨 Found ${highPointParticipants.length} participant(s) with unusually high points:`);
    
    for (const participant of highPointParticipants) {
      console.log('\n' + '='.repeat(60));
      
      // Get user record
      const user = await User.findOne({ googleId: participant.userId });
      
      // Get challenge record
      const challenge = await Challenge.findById(participant.challengeId);
      
      console.log('👤 User:', {
        name: user?.name || 'Unknown',
        email: user?.email || 'Unknown',
        googleId: participant.userId
      });
      
      console.log('🏆 Challenge:', {
        name: challenge?.name || 'Unknown',
        challengeId: participant.challengeId
      });
      
      console.log('📊 Points Breakdown:', {
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
      const discrepancy = participant.points - expectedTotal;
      
      console.log('🧮 Analysis:', {
        startingWeight: participant.startingWeight,
        lastWeight: participant.lastWeight,
        weightLost: participant.startingWeight && participant.lastWeight ? participant.startingWeight - participant.lastWeight : 'N/A',
        percentLost: participant.startingWeight && participant.lastWeight ? ((participant.startingWeight - participant.lastWeight) / participant.startingWeight * 100).toFixed(2) + '%' : 'N/A',
        expectedWeightLossPoints,
        expectedStepGoalPoints: participant.stepGoalPoints || 0,
        expectedTotal,
        actualTotal: participant.points,
        discrepancy
      });
      
      if (discrepancy > 0) {
        console.log('⚠️  POINTS ISSUE DETECTED!');
        console.log(`    Expected: ${expectedTotal}, Actual: ${participant.points}, Difference: +${discrepancy}`);
      }
    }
    
    // Also check for any participants with more than 10 step goal points (suspicious)
    const highStepGoalParticipants = await ChallengeParticipant.find({ stepGoalPoints: { $gt: 10 } });
    
    if (highStepGoalParticipants.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`🚨 Found ${highStepGoalParticipants.length} participant(s) with unusually high step goal points:`);
      
      for (const participant of highStepGoalParticipants) {
        const user = await User.findOne({ googleId: participant.userId });
        const challenge = await Challenge.findById(participant.challengeId);
        
        console.log(`  - ${user?.name || 'Unknown'} in "${challenge?.name || 'Unknown'}": ${participant.stepGoalPoints} step goal points`);
      }
    }
    
    // Check for any participants with more than 100 weight loss points (suspicious)
    const highWeightLossParticipants = await ChallengeParticipant.find({ weightLossPoints: { $gt: 100 } });
    
    if (highWeightLossParticipants.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`🚨 Found ${highWeightLossParticipants.length} participant(s) with unusually high weight loss points:`);
      
      for (const participant of highWeightLossParticipants) {
        const user = await User.findOne({ googleId: participant.userId });
        const challenge = await Challenge.findById(participant.challengeId);
        
        console.log(`  - ${user?.name || 'Unknown'} in "${challenge?.name || 'Unknown'}": ${participant.weightLossPoints} weight loss points`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking high points:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await checkAllHighPoints();
    
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

module.exports = checkAllHighPoints; 