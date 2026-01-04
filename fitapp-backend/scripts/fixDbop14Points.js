const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');

// Script to fix dbop14's incorrect 1304 points
async function fixDbop14Points() {
  try {
    console.log('🔧 Fixing dbop14 points from 1304 to correct value...');
    
    // Find dbop14 by email
    const user = await User.findOne({ email: 'dbop14@gmail.com' });
    
    if (!user) {
      console.log('❌ User dbop14@gmail.com not found');
      return;
    }
    
    console.log('👤 Found user:', {
      name: user.name,
      email: user.email,
      googleId: user.googleId
    });
    
    // Find their challenge participation
    const participant = await ChallengeParticipant.findOne({ userId: user.googleId });
    
    if (!participant) {
      console.log('❌ No challenge participation found for dbop14');
      return;
    }
    
    console.log('📊 Current participant data:', {
      totalPoints: participant.points,
      stepGoalPoints: participant.stepGoalPoints || 0,
      weightLossPoints: participant.weightLossPoints || 0,
      startingWeight: participant.startingWeight,
      lastWeight: participant.lastWeight
    });
    
    // Calculate what the points should be
    let expectedWeightLossPoints = 0;
    if (participant.startingWeight && participant.lastWeight) {
      const percentLost = ((participant.startingWeight - participant.lastWeight) / participant.startingWeight) * 100;
      expectedWeightLossPoints = Math.floor(percentLost);
    }
    
    const expectedTotal = expectedWeightLossPoints + (participant.stepGoalPoints || 0);
    
    console.log('🧮 Corrected calculation:', {
      startingWeight: participant.startingWeight,
      lastWeight: participant.lastWeight,
      weightLost: participant.startingWeight && participant.lastWeight ? participant.startingWeight - participant.lastWeight : 'N/A',
      percentLost: participant.startingWeight && participant.lastWeight ? ((participant.startingWeight - participant.lastWeight) / participant.startingWeight * 100).toFixed(2) + '%' : 'N/A',
      expectedWeightLossPoints,
      expectedStepGoalPoints: participant.stepGoalPoints || 0,
      expectedTotal,
      currentTotal: participant.points,
      difference: participant.points - expectedTotal
    });
    
    // Fix the points
    participant.points = expectedTotal;
    participant.weightLossPoints = expectedWeightLossPoints;
    
    await participant.save();
    
    console.log('✅ Fixed dbop14 points!');
    console.log('📊 New participant data:', {
      totalPoints: participant.points,
      stepGoalPoints: participant.stepGoalPoints || 0,
      weightLossPoints: participant.weightLossPoints || 0
    });
    
  } catch (error) {
    console.error('❌ Error fixing dbop14 points:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await fixDbop14Points();
    
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

module.exports = fixDbop14Points; 