const mongoose = require('mongoose');
const User = require('../models/User');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const Challenge = require('../models/Challenge');

// Script to test multi-user challenge workflow
async function testMultiUserWorkflow() {
  try {
    console.log('🧪 Testing Multi-User Challenge Workflow...');
    
    const user1Email = 'dbop14@gmail.com';
    const user2Email = 'dbop1414@gmail.com';
    
    // Find both users
    const user1 = await User.findOne({ email: user1Email });
    const user2 = await User.findOne({ email: user2Email });
    
    console.log('\n👥 Users Status:');
    console.log(`User 1 (${user1Email}):`, user1 ? '✅ Found' : '❌ Not found');
    if (user1) {
      console.log(`  - Name: ${user1.name}`);
      console.log(`  - Google ID: ${user1.googleId}`);
      console.log(`  - Steps: ${user1.steps || 0}`);
      console.log(`  - Weight: ${user1.weight || 0}`);
    }
    
    console.log(`User 2 (${user2Email}):`, user2 ? '✅ Found' : '❌ Not found');
    if (user2) {
      console.log(`  - Name: ${user2.name}`);
      console.log(`  - Google ID: ${user2.googleId}`);
      console.log(`  - Steps: ${user2.steps || 0}`);
      console.log(`  - Weight: ${user2.weight || 0}`);
    }
    
    if (!user1 && !user2) {
      console.log('❌ No users found to test with');
      return;
    }
    
    // Find challenges for each user
    console.log('\n🏆 Challenge Participation:');
    
    if (user1) {
      const user1Participants = await ChallengeParticipant.find({ userId: user1.googleId });
      const user1Challenges = [];
      
      for (const participant of user1Participants) {
        const challenge = await Challenge.findById(participant.challengeId);
        if (challenge) {
          user1Challenges.push({
            challenge,
            participant,
            isAdmin: challenge.admin === user1.googleId
          });
        }
      }
      
      console.log(`\n${user1.name} (${user1Email}):`);
      console.log(`  Participating in ${user1Challenges.length} challenge(s):`);
      
      for (const { challenge, participant, isAdmin } of user1Challenges) {
        console.log(`  - "${challenge.name}" (${challenge._id})`);
        console.log(`    Admin: ${isAdmin ? '👑 YES' : '👤 No'}`);
        console.log(`    Points: ${participant.points} (${participant.stepGoalPoints || 0} step, ${participant.weightLossPoints || 0} weight)`);
        console.log(`    Participants: ${challenge.participants.length} total`);
        
        // Check if user2 is also in this challenge
        const user2InChallenge = user2 && challenge.participants.includes(user2.email);
        if (user2InChallenge) {
          console.log(`    🤝 ${user2.name} is also in this challenge`);
        }
      }
    }
    
    if (user2) {
      const user2Participants = await ChallengeParticipant.find({ userId: user2.googleId });
      const user2Challenges = [];
      
      for (const participant of user2Participants) {
        const challenge = await Challenge.findById(participant.challengeId);
        if (challenge) {
          user2Challenges.push({
            challenge,
            participant,
            isAdmin: challenge.admin === user2.googleId
          });
        }
      }
      
      console.log(`\n${user2.name} (${user2Email}):`);
      console.log(`  Participating in ${user2Challenges.length} challenge(s):`);
      
      for (const { challenge, participant, isAdmin } of user2Challenges) {
        console.log(`  - "${challenge.name}" (${challenge._id})`);
        console.log(`    Admin: ${isAdmin ? '👑 YES' : '👤 No'}`);
        console.log(`    Points: ${participant.points} (${participant.stepGoalPoints || 0} step, ${participant.weightLossPoints || 0} weight)`);
        console.log(`    Participants: ${challenge.participants.length} total`);
        
        // Check if user1 is also in this challenge
        const user1InChallenge = user1 && challenge.participants.includes(user1.email);
        if (user1InChallenge) {
          console.log(`    🤝 ${user1.name} is also in this challenge`);
        }
      }
    }
    
    // Test scenarios
    console.log('\n🧪 Testing Scenarios:');
    
    // Scenario 1: Check for shared challenges
    if (user1 && user2) {
      const user1ChallengeIds = (await ChallengeParticipant.find({ userId: user1.googleId })).map(p => p.challengeId.toString());
      const user2ChallengeIds = (await ChallengeParticipant.find({ userId: user2.googleId })).map(p => p.challengeId.toString());
      
      const sharedChallenges = user1ChallengeIds.filter(id => user2ChallengeIds.includes(id));
      
      console.log(`\n1️⃣ Shared Challenges: ${sharedChallenges.length}`);
      
      for (const challengeId of sharedChallenges) {
        const challenge = await Challenge.findById(challengeId);
        const user1Participant = await ChallengeParticipant.findOne({ challengeId, userId: user1.googleId });
        const user2Participant = await ChallengeParticipant.findOne({ challengeId, userId: user2.googleId });
        
        console.log(`   Challenge: "${challenge.name}"`);
        console.log(`   Admin: ${challenge.admin === user1.googleId ? user1.name : challenge.admin === user2.googleId ? user2.name : 'Other'}`);
        console.log(`   ${user1.name}: ${user1Participant?.points || 0} points`);
        console.log(`   ${user2.name}: ${user2Participant?.points || 0} points`);
      }
    }
    
    // Scenario 2: Test leave challenge workflow
    console.log(`\n2️⃣ Leave Challenge Workflow Test:`);
    
    if (user2) {
      const user2Participants = await ChallengeParticipant.find({ userId: user2.googleId });
      
      for (const participant of user2Participants) {
        const challenge = await Challenge.findById(participant.challengeId);
        if (!challenge) {
          console.log(`   ❌ ${user2.name} has orphaned record for challenge ${participant.challengeId}`);
          console.log(`   🔧 This should be cleaned up`);
        } else {
          const isAdmin = challenge.admin === user2.googleId;
          const canLeave = !isAdmin;
          
          console.log(`   Challenge: "${challenge.name}"`);
          console.log(`   ${user2.name} is ${isAdmin ? 'admin 👑' : 'participant 👤'}`);
          console.log(`   Can leave: ${canLeave ? '✅ Yes' : '❌ No (admin must delete)'}`);
          
          if (!challenge.participants.includes(user2.email)) {
            console.log(`   ⚠️ Data inconsistency: User not in participants array`);
          }
        }
      }
    }
    
    // Scenario 3: Test admin delete workflow
    console.log(`\n3️⃣ Admin Delete Workflow Test:`);
    
    const allChallenges = await Challenge.find({});
    
    for (const challenge of allChallenges) {
      const admin = await User.findOne({ googleId: challenge.admin });
      const participants = await ChallengeParticipant.find({ challengeId: challenge._id });
      
      console.log(`   Challenge: "${challenge.name}"`);
      console.log(`   Admin: ${admin?.name || challenge.admin} (${admin?.email || 'Unknown'})`);
      console.log(`   Participants: ${participants.length} records, ${challenge.participants.length} in array`);
      
      const nonAdminParticipants = participants.filter(p => p.userId !== challenge.admin);
      console.log(`   Non-admin participants: ${nonAdminParticipants.length}`);
      
      if (nonAdminParticipants.length > 0) {
        console.log(`   🗑️ If admin deletes, ${nonAdminParticipants.length} participant(s) will be removed:`);
        for (const participant of nonAdminParticipants) {
          const user = await User.findOne({ googleId: participant.userId });
          console.log(`     - ${user?.name || participant.userId} (${participant.points} points)`);
        }
      }
    }
    
    console.log('\n✅ Multi-user workflow test completed!');
    
    return {
      user1Found: !!user1,
      user2Found: !!user2,
      totalChallenges: allChallenges.length,
      workflowReady: true
    };
    
  } catch (error) {
    console.error('❌ Error testing multi-user workflow:', error);
    throw error;
  }
}

// Connect to MongoDB and run the test
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    
    const result = await testMultiUserWorkflow();
    
    console.log('\n📋 Test Summary:', result);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = testMultiUserWorkflow;