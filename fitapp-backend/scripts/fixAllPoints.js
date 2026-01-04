const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Comprehensive script to fix all incorrect points data
async function fixAllPoints() {
  try {
    console.log('🔧 Starting comprehensive points fix for all participants...');
    
    // Get all participants
    const allParticipants = await ChallengeParticipant.find({});
    console.log(`📊 Found ${allParticipants.length} participant records to check`);
    
    let fixedCount = 0;
    let totalDiscrepancy = 0;
    
    for (const participant of allParticipants) {
      console.log(`\n🔍 Checking participant ${participant.userId} in challenge ${participant.challengeId}...`);
      
      // Get user and challenge info
      const user = await User.findOne({ googleId: participant.userId });
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!user || !challenge) {
        console.log(`⚠️  Skipping: User or challenge not found`);
        continue;
      }
      
      // Calculate what the points should be
      let expectedWeightLossPoints = 0;
      if (participant.startingWeight && participant.lastWeight) {
        const totalWeightLost = participant.startingWeight - participant.lastWeight;
        const totalPercentLost = (totalWeightLost / participant.startingWeight) * 100;
        expectedWeightLossPoints = Math.floor(totalPercentLost);
        
        // Cap at 100% to prevent unreasonable values
        if (expectedWeightLossPoints > 100) {
          console.log(`⚠️  Capping weight loss points from ${expectedWeightLossPoints} to 100`);
          expectedWeightLossPoints = 100;
        }
      }
      
      const expectedStepGoalPoints = participant.stepGoalPoints || 0;
      const expectedTotal = expectedWeightLossPoints + expectedStepGoalPoints;
      const currentTotal = participant.points;
      const discrepancy = currentTotal - expectedTotal;
      
      console.log('📊 Current data:', {
        user: user.name,
        challenge: challenge.name,
        startingWeight: participant.startingWeight,
        lastWeight: participant.lastWeight,
        currentPoints: currentTotal,
        currentWeightLossPoints: participant.weightLossPoints || 0,
        currentStepGoalPoints: expectedStepGoalPoints
      });
      
      console.log('🧮 Expected data:', {
        expectedWeightLossPoints,
        expectedStepGoalPoints,
        expectedTotal,
        discrepancy
      });
      
      // Fix if there's a discrepancy
      if (Math.abs(discrepancy) > 0) {
        console.log(`🔧 Fixing points: ${currentTotal} → ${expectedTotal} (${discrepancy > 0 ? '+' : ''}${discrepancy})`);
        
        // Update points to correct values
        participant.points = expectedTotal;
        participant.weightLossPoints = expectedWeightLossPoints;
        
        // Ensure step goal points are properly set
        if (!participant.stepGoalPoints) {
          participant.stepGoalPoints = 0;
        }
        
        await participant.save();
        fixedCount++;
        totalDiscrepancy += Math.abs(discrepancy);
        
        console.log('✅ Fixed!');
      } else {
        console.log('✅ Points are already correct');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 FIX SUMMARY');
    console.log(`Total participants checked: ${allParticipants.length}`);
    console.log(`Participants fixed: ${fixedCount}`);
    console.log(`Total point discrepancy resolved: ${totalDiscrepancy}`);
    
    if (fixedCount === 0) {
      console.log('✅ No point calculation issues found!');
    } else {
      console.log('🔧 Points have been corrected to prevent future issues');
      console.log('💡 The new logic in index.js will prevent these issues from recurring');
    }
    
  } catch (error) {
    console.error('❌ Error fixing all points:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await fixAllPoints();
    
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

module.exports = fixAllPoints;
