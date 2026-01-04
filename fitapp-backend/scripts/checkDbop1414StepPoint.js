const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Script to check if dbop1414 has an incorrect step point
async function checkDbop1414StepPoint() {
  try {
    console.log('🔍 Checking dbop1414 step point issue...');
    
    // Find dbop1414 by email
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
      lastSync: user.lastSync
    });
    
    // Find all participant records
    const participants = await ChallengeParticipant.find({ userId: user.googleId });
    
    for (const participant of participants) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      console.log('\n' + '='.repeat(60));
      console.log('🏆 Challenge:', challenge?.name || 'Unknown');
      console.log('📊 Step Goal:', challenge?.stepGoal || 'Unknown');
      console.log('📊 Current Steps (from User):', user.steps);
      console.log('📊 Last Step Count (from Participant):', participant.lastStepCount);
      console.log('📊 Step Goal Points:', participant.stepGoalPoints || 0);
      console.log('📊 Last Step Date:', participant.lastStepDate);
      console.log('📊 Last Step Point Timestamp:', participant.lastStepPointTimestamp);
      
      // Check if step goal is actually met
      const stepsToCheck = user.steps || participant.lastStepCount || 0;
      const stepGoal = challenge?.stepGoal || 0;
      const goalMet = stepsToCheck >= stepGoal;
      
      console.log('\n🔍 VALIDATION CHECK:');
      console.log(`  Steps: ${stepsToCheck}`);
      console.log(`  Step Goal: ${stepGoal}`);
      console.log(`  Goal Met: ${goalMet}`);
      console.log(`  Current Step Points: ${participant.stepGoalPoints || 0}`);
      
      if (!goalMet && participant.stepGoalPoints > 0) {
        console.log('\n🚨 ISSUE FOUND: User has step points but goal is NOT met!');
        console.log('   This suggests either:');
        console.log('   1. Old data from before strict validation');
        console.log('   2. Step goal was changed after point was awarded');
        console.log('   3. Steps decreased after point was awarded');
      } else if (goalMet) {
        console.log('\n✅ Goal is met - step points are valid');
      } else {
        console.log('\n✅ No step points - correct state');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Connect and run
async function main() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    await checkDbop1414StepPoint();
    
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

module.exports = checkDbop1414StepPoint;

