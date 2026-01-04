const mongoose = require('mongoose');
const User = require('../models/User');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const Challenge = require('../models/Challenge');

// Script to identify and fix stuck user dbop1414
async function fixStuckUser() {
  try {
    console.log('🔍 Investigating dbop1414 stuck in challenge...');
    
    // Find the user by email
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    if (!user) {
      console.log('❌ User dbop1414@gmail.com not found in User collection');
      return;
    }
    
    console.log('✅ Found user:', {
      name: user.name,
      email: user.email,
      googleId: user.googleId
    });
    
    // Find all participant records for this user
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    console.log(`\n📊 Found ${participantRecords.length} participant record(s) for dbop1414:`);
    
    for (const participant of participantRecords) {
      console.log(`\n🔍 Participant Record:`, {
        challengeId: participant.challengeId,
        userId: participant.userId,
        points: participant.points,
        stepGoalPoints: participant.stepGoalPoints || 0,
        weightLossPoints: participant.weightLossPoints || 0
      });
      
      // Check if the corresponding challenge exists
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        console.log(`❌ ORPHANED RECORD: Challenge ${participant.challengeId} does not exist!`);
        console.log(`🗑️ Removing orphaned participant record...`);
        
        await ChallengeParticipant.findByIdAndDelete(participant._id);
        console.log(`✅ Deleted orphaned participant record for challenge ${participant.challengeId}`);
      } else {
        console.log(`✅ Challenge exists:`, {
          name: challenge.name,
          admin: challenge.admin,
          participants: challenge.participants,
          isUserInParticipants: challenge.participants.includes(user.email)
        });
        
        // Check if user is in challenge participants array
        if (!challenge.participants.includes(user.email)) {
          console.log(`⚠️ User is NOT in challenge participants array`);
          console.log(`🔧 Adding user to challenge participants array...`);
          
          challenge.participants.push(user.email);
          await challenge.save();
          console.log(`✅ Added ${user.email} to challenge participants array`);
        }
      }
    }
    
    // Also check if user appears in any challenge participants arrays without a ChallengeParticipant record
    console.log(`\n🔍 Checking for challenges where user is in participants array...`);
    const challengesWithUser = await Challenge.find({ 
      participants: user.email 
    });
    
    console.log(`📊 Found ${challengesWithUser.length} challenge(s) with user in participants array:`);
    
    for (const challenge of challengesWithUser) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      console.log(`\nChallenge: ${challenge.name} (${challenge._id})`);
      console.log(`Has participant record: ${!!hasParticipantRecord}`);
      
      if (!hasParticipantRecord) {
        console.log(`⚠️ Missing ChallengeParticipant record for user in this challenge`);
        console.log(`🔧 Creating missing participant record...`);
        
        const newParticipant = new ChallengeParticipant({
          challengeId: challenge._id,
          userId: user.googleId,
          startingWeight: user.weight || 0,
          lastWeight: user.weight || 0,
          lastStepDate: user.lastSync || new Date(),
          lastStepCount: user.steps || 0,
          points: 0,
          stepGoalPoints: 0,
          weightLossPoints: 0,
          stepGoalDaysAchieved: 0
        });
        
        await newParticipant.save();
        console.log(`✅ Created missing participant record`);
      }
    }
    
    console.log(`\n🎯 Final Status Check:`);
    const finalParticipants = await ChallengeParticipant.find({ userId: user.googleId });
    const finalChallenges = await Challenge.find({ participants: user.email });
    
    console.log(`Participant records: ${finalParticipants.length}`);
    console.log(`Challenges with user: ${finalChallenges.length}`);
    
    for (const participant of finalParticipants) {
      const challenge = await Challenge.findById(participant.challengeId);
      console.log(`- ${challenge?.name || 'Unknown'} (${participant.challengeId})`);
    }
    
    console.log(`\n✅ dbop1414 cleanup completed!`);
    
  } catch (error) {
    console.error('❌ Error fixing stuck user:', error);
  }
}

// Connect to MongoDB and run the fix
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await fixStuckUser();
    
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

module.exports = fixStuckUser;