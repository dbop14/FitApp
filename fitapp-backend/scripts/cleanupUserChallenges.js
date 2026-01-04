const mongoose = require('mongoose');
const User = require('../models/User');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const Challenge = require('../models/Challenge');

// Script to clean up user challenges and fix inconsistent data
async function cleanupUserChallenges(userEmail) {
  try {
    console.log(`🧹 Cleaning up challenges for user: ${userEmail}`);
    
    // Find the user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log(`❌ User ${userEmail} not found in User collection`);
      return;
    }
    
    console.log('✅ Found user:', {
      name: user.name,
      email: user.email,
      googleId: user.googleId
    });
    
    let cleanupActions = [];
    
    // 1. Find all participant records for this user
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    console.log(`\n📊 Found ${participantRecords.length} participant record(s):`);
    
    for (const participant of participantRecords) {
      console.log(`\n🔍 Checking participant record for challenge: ${participant.challengeId}`);
      
      // Check if the corresponding challenge exists
      const challenge = await Challenge.findById(participant.challengeId);
      
      if (!challenge) {
        console.log(`❌ ORPHANED RECORD: Challenge ${participant.challengeId} does not exist!`);
        console.log(`🗑️ Will remove orphaned participant record...`);
        
        cleanupActions.push({
          type: 'deleteOrphanedParticipant',
          participantId: participant._id,
          challengeId: participant.challengeId,
          userPoints: participant.points
        });
      } else {
        console.log(`✅ Challenge exists: "${challenge.name}"`);
        
        // Check if user is in challenge participants array
        if (!challenge.participants.includes(user.email)) {
          console.log(`⚠️ User is NOT in challenge participants array`);
          console.log(`🔧 Will add user to challenge participants array...`);
          
          cleanupActions.push({
            type: 'addToParticipantsArray',
            challengeId: challenge._id,
            challengeName: challenge.name,
            userEmail: user.email
          });
        } else {
          console.log(`✅ User is properly in participants array`);
        }
      }
    }
    
    // 2. Check for challenges where user is in participants array but missing ChallengeParticipant record
    console.log(`\n🔍 Checking for challenges with missing participant records...`);
    const challengesWithUser = await Challenge.find({ 
      participants: user.email 
    });
    
    console.log(`📊 Found ${challengesWithUser.length} challenge(s) with user in participants array:`);
    
    for (const challenge of challengesWithUser) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      console.log(`\nChallenge: "${challenge.name}" (${challenge._id})`);
      console.log(`Has participant record: ${!!hasParticipantRecord}`);
      
      if (!hasParticipantRecord) {
        console.log(`⚠️ Missing ChallengeParticipant record`);
        console.log(`🔧 Will create missing participant record...`);
        
        cleanupActions.push({
          type: 'createMissingParticipant',
          challengeId: challenge._id,
          challengeName: challenge.name,
          userId: user.googleId,
          userWeight: user.weight || 0,
          userSteps: user.steps || 0,
          userLastSync: user.lastSync || new Date()
        });
      }
    }
    
    // 3. Execute cleanup actions
    console.log(`\n🔧 Executing ${cleanupActions.length} cleanup action(s):`);
    
    for (const action of cleanupActions) {
      switch (action.type) {
        case 'deleteOrphanedParticipant':
          console.log(`🗑️ Deleting orphaned participant record for challenge ${action.challengeId}...`);
          await ChallengeParticipant.findByIdAndDelete(action.participantId);
          console.log(`✅ Deleted orphaned record (user had ${action.userPoints} points)`);
          break;
          
        case 'addToParticipantsArray':
          console.log(`🔧 Adding ${action.userEmail} to challenge "${action.challengeName}" participants array...`);
          const challenge = await Challenge.findById(action.challengeId);
          if (challenge && !challenge.participants.includes(action.userEmail)) {
            challenge.participants.push(action.userEmail);
            await challenge.save();
            console.log(`✅ Added to participants array`);
          }
          break;
          
        case 'createMissingParticipant':
          console.log(`🔧 Creating missing participant record for challenge "${action.challengeName}"...`);
          const newParticipant = new ChallengeParticipant({
            challengeId: action.challengeId,
            userId: action.userId,
            startingWeight: action.userWeight,
            lastWeight: action.userWeight,
            lastStepDate: action.userLastSync,
            lastStepCount: action.userSteps,
            points: 0,
            stepGoalPoints: 0,
            weightLossPoints: 0,
            stepGoalDaysAchieved: 0
          });
          
          await newParticipant.save();
          console.log(`✅ Created participant record`);
          break;
      }
    }
    
    // 4. Final status check
    console.log(`\n🎯 Final Status Check:`);
    const finalParticipants = await ChallengeParticipant.find({ userId: user.googleId });
    const finalChallenges = await Challenge.find({ participants: user.email });
    
    console.log(`Final participant records: ${finalParticipants.length}`);
    console.log(`Final challenges with user: ${finalChallenges.length}`);
    
    if (finalParticipants.length === finalChallenges.length) {
      console.log(`✅ Data consistency achieved!`);
    } else {
      console.log(`⚠️ Data inconsistency remains:`);
      console.log(`  Participant records: ${finalParticipants.length}`);
      console.log(`  Challenges with user: ${finalChallenges.length}`);
    }
    
    for (const participant of finalParticipants) {
      const challenge = await Challenge.findById(participant.challengeId);
      console.log(`- "${challenge?.name || 'Unknown'}" (${participant.challengeId}) - ${participant.points} points`);
    }
    
    console.log(`\n✅ Cleanup completed for ${userEmail}!`);
    
    return {
      user: user.email,
      actionsPerformed: cleanupActions.length,
      finalParticipants: finalParticipants.length,
      finalChallenges: finalChallenges.length,
      consistent: finalParticipants.length === finalChallenges.length
    };
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Connect to MongoDB and run the cleanup
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    // Clean up dbop1414 by default, but allow other users via command line
    const userEmail = process.argv[2] || 'dbop1414@gmail.com';
    const result = await cleanupUserChallenges(userEmail);
    
    console.log('\n📋 Cleanup Summary:', result);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = cleanupUserChallenges;