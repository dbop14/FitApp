const mongoose = require('mongoose');
const User = require('../models/User');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const Challenge = require('../models/Challenge');

// Quick script to inspect dbop1414's specific issue
async function inspectStuckUser() {
  try {
    console.log('🔍 Inspecting dbop1414 stuck in "test Leaderboard" challenge...');
    
    // Find dbop1414
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    if (!user) {
      console.log('❌ User dbop1414@gmail.com not found');
      return;
    }
    
    console.log('✅ Found user:', {
      name: user.name,
      email: user.email,
      googleId: user.googleId
    });
    
    // Find the "test Leaderboard" challenge
    const testChallenge = await Challenge.findOne({ name: /test.*leaderboard/i });
    if (testChallenge) {
      console.log('\n🎯 Found "test Leaderboard" challenge:', {
        id: testChallenge._id,
        name: testChallenge.name,
        admin: testChallenge.admin,
        participants: testChallenge.participants
      });
      
      // Check if user is in participants array
      const userInArray = testChallenge.participants.includes(user.email);
      console.log(`User in participants array: ${userInArray ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log('\n❌ "test Leaderboard" challenge not found');
    }
    
    // Find all participant records for dbop1414
    const participantRecords = await ChallengeParticipant.find({ userId: user.googleId });
    console.log(`\n📊 dbop1414 has ${participantRecords.length} participant record(s):`);
    
    for (const participant of participantRecords) {
      const challenge = await Challenge.findById(participant.challengeId);
      
      console.log(`\n🔍 Participant Record:`);
      console.log(`  Challenge ID: ${participant.challengeId}`);
      console.log(`  Challenge exists: ${challenge ? '✅ Yes' : '❌ No'}`);
      
      if (challenge) {
        console.log(`  Challenge name: "${challenge.name}"`);
        console.log(`  Is "test Leaderboard"?: ${challenge.name.toLowerCase().includes('test') && challenge.name.toLowerCase().includes('leaderboard')}`);
        console.log(`  User in participants array: ${challenge.participants.includes(user.email) ? '✅ Yes' : '❌ No'}`);
        console.log(`  User points: ${participant.points}`);
        console.log(`  Admin: ${challenge.admin}`);
        console.log(`  Is user admin?: ${challenge.admin === user.googleId}`);
      } else {
        console.log(`  ❌ ORPHANED RECORD - Challenge ${participant.challengeId} doesn't exist!`);
        console.log(`  🗑️ This record should be deleted`);
      }
    }
    
    // Check for challenges where user is in array but no participant record
    const challengesWithUser = await Challenge.find({ participants: user.email });
    console.log(`\n📋 Challenges containing ${user.email} in participants array: ${challengesWithUser.length}`);
    
    for (const challenge of challengesWithUser) {
      const hasParticipantRecord = await ChallengeParticipant.findOne({ 
        challengeId: challenge._id, 
        userId: user.googleId 
      });
      
      console.log(`\n🔍 Challenge: "${challenge.name}"`);
      console.log(`  ID: ${challenge._id}`);
      console.log(`  Has participant record: ${hasParticipantRecord ? '✅ Yes' : '❌ No'}`);
      
      if (!hasParticipantRecord) {
        console.log(`  ⚠️ MISSING PARTICIPANT RECORD - Should create one`);
      }
    }
    
    // Summary and recommendations
    console.log(`\n🎯 SUMMARY:`);
    console.log(`Participant records: ${participantRecords.length}`);
    console.log(`Challenges with user: ${challengesWithUser.length}`);
    
    const orphanedRecords = participantRecords.filter(async p => {
      const challenge = await Challenge.findById(p.challengeId);
      return !challenge;
    });
    
    if (participantRecords.length !== challengesWithUser.length) {
      console.log(`❌ DATA INCONSISTENCY DETECTED`);
      console.log(`\n🔧 RECOMMENDED ACTIONS:`);
      
      // Check for orphaned records
      for (const participant of participantRecords) {
        const challenge = await Challenge.findById(participant.challengeId);
        if (!challenge) {
          console.log(`1. DELETE orphaned participant record for challenge ${participant.challengeId}`);
        }
      }
      
      // Check for missing records
      for (const challenge of challengesWithUser) {
        const hasParticipantRecord = await ChallengeParticipant.findOne({ 
          challengeId: challenge._id, 
          userId: user.googleId 
        });
        
        if (!hasParticipantRecord) {
          console.log(`2. CREATE missing participant record for challenge "${challenge.name}" (${challenge._id})`);
        }
      }
    } else {
      console.log(`✅ Data appears consistent`);
    }
    
  } catch (error) {
    console.error('❌ Error inspecting user:', error);
  }
}

// Connect to MongoDB and run the inspection
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    await inspectStuckUser();
    
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

module.exports = inspectStuckUser;