const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');

async function cleanupDuplicates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fitapp');
    console.log('Connected to MongoDB');
    
    // Get all participants
    const allParticipants = await ChallengeParticipant.find({});
    console.log(`Found ${allParticipants.length} total participant records`);
    
    // Group by challengeId-userId combination
    const groups = {};
    const duplicates = [];
    
    for (const participant of allParticipants) {
      const key = `${participant.challengeId}-${participant.userId}`;
      if (!groups[key]) {
        groups[key] = [participant];
      } else {
        groups[key].push(participant);
        duplicates.push(participant._id);
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate records to remove`);
    
    // Remove duplicates
    if (duplicates.length > 0) {
      const result = await ChallengeParticipant.deleteMany({ _id: { $in: duplicates } });
      console.log(`Removed ${result.deletedCount} duplicate records`);
    }
    
    // Verify cleanup
    const remainingParticipants = await ChallengeParticipant.find({});
    console.log(`Remaining participant records: ${remainingParticipants.length}`);
    
    // Create unique index
    try {
      await ChallengeParticipant.collection.createIndex(
        { challengeId: 1, userId: 1 }, 
        { unique: true }
      );
      console.log('✅ Created unique compound index');
    } catch (indexError) {
      console.log('Index might already exist or there are still duplicates:', indexError.message);
    }
    
    console.log('✅ Cleanup complete');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

cleanupDuplicates(); 