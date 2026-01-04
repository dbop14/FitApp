const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Quick check of dbop1414's current state
async function checkCurrentState() {
  try {
    // Use same connection pattern as other scripts
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp';
    console.log(`🔌 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to MongoDB`);
    
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    const participants = await ChallengeParticipant.find({ userId: user.googleId });
    
    for (const p of participants) {
      const challenge = await Challenge.findById(p.challengeId);
      const currentSteps = user.steps || p.lastStepCount || 0;
      const stepGoal = challenge?.stepGoal || 0;
      const goalMet = currentSteps >= stepGoal;
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 CURRENT STATE FOR dbop1414:');
      console.log(`  Challenge: ${challenge?.name || 'Unknown'}`);
      console.log(`  Step Goal: ${stepGoal}`);
      console.log(`  Current Steps: ${currentSteps}`);
      console.log(`  Goal Met: ${goalMet}`);
      console.log(`  Current Step Points: ${p.stepGoalPoints || 0}`);
      console.log(`  Last Step Date: ${p.lastStepDate}`);
      console.log(`  Last Step Point Timestamp: ${p.lastStepPointTimestamp}`);
      
      if (p.stepGoalPoints > 0 && !goalMet) {
        console.log('\n🚨 ISSUE: User has step points but goal is NOT met!');
        console.log('   This is either:');
        console.log('   1. Old data from before strict validation');
        console.log('   2. Steps decreased after point was awarded');
        console.log('   3. Step goal was increased after point was awarded');
      } else if (p.stepGoalPoints > 0 && goalMet) {
        console.log('\n✅ Step points are valid (goal is met)');
      } else {
        console.log('\n✅ No step points (correct state)');
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCurrentState();

