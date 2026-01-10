const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');

// Script to add a step goal point for a user in a challenge
async function addStepPoint(userId, challengeId) {
  try {
    console.log(`🔄 Adding step goal point for user ${userId} in challenge ${challengeId}...`);

    // Find the participant record
    const participant = await ChallengeParticipant.findOne({ 
      userId: userId, 
      challengeId: challengeId 
    });
    
    if (!participant) {
      console.log('❌ Participant record not found');
      return;
    }
    
    console.log('📊 Current participant data:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
    });
    
    // Add the additional step goal point
    participant.points += 1;
    participant.stepGoalPoints += 1;
    participant.stepGoalDaysAchieved += 1;
    
    await participant.save();
    
    console.log('✅ Successfully added step goal point!');
    console.log('📊 Updated participant data:', {
      points: participant.points,
      stepGoalPoints: participant.stepGoalPoints,
      stepGoalDaysAchieved: participant.stepGoalDaysAchieved,
    });
    
  } catch (error) {
    console.error('❌ Error adding step point:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    // It's good practice to use environment variables for connection strings
    const dbUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');
    
    const userId = '108452956929429773201';
    const challengeId = '695aeac3f3d5d69eab7e9d3e';
    
    await addStepPoint(userId, challengeId);
    
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

module.exports = addStepPoint;
