const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');

// Migration script to add new fields to existing participants
async function migrateParticipants() {
  try {
    console.log('🔄 Starting participant migration...');
    
    // Update all participants that don't have the new fields
    const result = await ChallengeParticipant.updateMany(
      {
        $or: [
          { stepGoalPoints: { $exists: false } },
          { weightLossPoints: { $exists: false } },
          { stepGoalDaysAchieved: { $exists: false } }
        ]
      },
      {
        $set: {
          stepGoalPoints: 0,
          weightLossPoints: 0,
          stepGoalDaysAchieved: 0
        }
      }
    );
    
    console.log(`✅ Migration completed! Updated ${result.modifiedCount} participants`);
    
    // Show updated participants
    const participants = await ChallengeParticipant.find({});
    console.log(`📊 Total participants: ${participants.length}`);
    
    participants.forEach(p => {
      console.log(`👤 ${p.userId}: stepGoalPoints=${p.stepGoalPoints}, weightLossPoints=${p.weightLossPoints}, stepGoalDaysAchieved=${p.stepGoalDaysAchieved}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Connect to MongoDB and run migration
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await migrateParticipants();
    
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

module.exports = migrateParticipants;