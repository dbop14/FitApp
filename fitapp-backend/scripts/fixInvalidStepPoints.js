const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to find and fix invalid step points (points awarded when goal wasn't met)
async function fixInvalidStepPoints() {
  try {
    console.log('🔍 Checking for invalid step points...');
    
    // Find dbop1414 by email
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    
    if (!user) {
      console.log('❌ User dbop1414@gmail.com not found');
      return;
    }
    
    console.log('👤 User:', user.email, '| Steps:', user.steps);
    
    // Find all participant records
    const participants = await ChallengeParticipant.find({ userId: user.googleId });
    
    for (const participant of participants) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        console.log('⚠️ Challenge not found for participant');
        continue;
      }
      
      const stepGoal = challenge.stepGoal || 0;
      const currentSteps = user.steps || participant.lastStepCount || 0;
      const stepGoalPoints = participant.stepGoalPoints || 0;
      
      console.log('\n' + '='.repeat(60));
      console.log('🏆 Challenge:', challenge.name);
      console.log('📊 Step Goal:', stepGoal);
      console.log('📊 Current Steps:', currentSteps);
      console.log('📊 Step Goal Points:', stepGoalPoints);
      console.log('📊 Goal Met:', currentSteps >= stepGoal);
      
      // If user has step points but goal is not met, this is invalid
      if (stepGoalPoints > 0 && currentSteps < stepGoal) {
        console.log('\n🚨 INVALID STEP POINT FOUND!');
        console.log(`   User has ${stepGoalPoints} step point(s) but only ${currentSteps} steps (goal: ${stepGoal})`);
        console.log('   This point was likely awarded before strict validation was implemented.');
        console.log(`   Last step point timestamp: ${participant.lastStepPointTimestamp}`);
        
        // Fix: Remove invalid step points
        console.log('\n🔧 FIXING: Removing invalid step point(s)...');
        
        // Calculate correct step points (should be 0 if goal not met)
        const correctStepPoints = 0;
        const oldStepPoints = participant.stepGoalPoints;
        const oldTotalPoints = participant.points;
        const oldStepGoalDaysAchieved = participant.stepGoalDaysAchieved || 0;
        
        participant.stepGoalPoints = correctStepPoints;
        participant.stepGoalDaysAchieved = Math.max(0, oldStepGoalDaysAchieved - oldStepPoints);
        
        // Clear the last step point timestamp since points are invalid
        participant.lastStepPointTimestamp = null;
        participant.lastStepDate = null;
        
        // Recalculate total points
        const weightLossPoints = participant.weightLossPoints || 0;
        participant.points = correctStepPoints + weightLossPoints;
        
        await participant.save();
        
        console.log('✅ FIXED:');
        console.log(`   Old Step Points: ${oldStepPoints} → New: ${correctStepPoints}`);
        console.log(`   Old Step Goal Days Achieved: ${oldStepGoalDaysAchieved} → New: ${participant.stepGoalDaysAchieved}`);
        console.log(`   Old Total Points: ${oldTotalPoints} → New: ${participant.points}`);
        console.log(`   Removed ${oldStepPoints} invalid step point(s)`);
        console.log(`   Cleared lastStepPointTimestamp and lastStepDate`);
      } else if (stepGoalPoints > 0 && currentSteps >= stepGoal) {
        console.log('\n✅ Step points are valid (goal is met)');
      } else {
        console.log('\n✅ No step points (correct state)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Connect and run
async function main() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://mongoosedb:27017/fitapp';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    await fixInvalidStepPoints();
    
    await mongoose.disconnect();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = fixInvalidStepPoints;

