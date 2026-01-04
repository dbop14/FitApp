const mongoose = require('mongoose');
const User = require('../models/User');
const ChallengeParticipant = require('../models/ChallengeParticipant');

// Script to find all users with "dbop" in their name/email
async function findDbopUsers() {
  try {
    console.log('🔍 Searching for users with "dbop" in their name or email...');
    
    // Search by name containing "dbop"
    const usersByName = await User.find({ 
      name: { $regex: /dbop/i } 
    });
    
    // Search by email containing "dbop"
    const usersByEmail = await User.find({ 
      email: { $regex: /dbop/i } 
    });
    
    // Combine and deduplicate
    const allUsers = [...usersByName, ...usersByEmail];
    const uniqueUsers = allUsers.filter((user, index, self) => 
      index === self.findIndex(u => u._id.toString() === user._id.toString())
    );
    
    if (uniqueUsers.length === 0) {
      console.log('❌ No users found with "dbop" in their name or email');
      return;
    }
    
    console.log(`✅ Found ${uniqueUsers.length} user(s) with "dbop" in their name or email:`);
    
    for (const user of uniqueUsers) {
      console.log('\n' + '='.repeat(60));
      console.log('👤 User Details:', {
        name: user.name,
        email: user.email,
        googleId: user.googleId,
        currentSteps: user.steps,
        currentWeight: user.weight
      });
      
      // Find all challenge participations for this user
      const participations = await ChallengeParticipant.find({ userId: user.googleId });
      
      if (participations.length === 0) {
        console.log('📊 No challenge participations found');
        continue;
      }
      
      console.log(`📊 Found ${participations.length} challenge participation(s):`);
      
      for (const participation of participations) {
        console.log(`  - Challenge ID: ${participation.challengeId}`);
        console.log(`    Total Points: ${participation.points}`);
        console.log(`    Step Goal Points: ${participation.stepGoalPoints || 0}`);
        console.log(`    Weight Loss Points: ${participation.weightLossPoints || 0}`);
        console.log(`    Starting Weight: ${participation.startingWeight || 'N/A'}`);
        console.log(`    Last Weight: ${participation.lastWeight || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding dbop users:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await findDbopUsers();
    
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

module.exports = findDbopUsers; 