/**
 * Script to remove test users from challenges and database
 * 
 * Usage:
 *   node cleanup-test-users.js
 * 
 * This will:
 * - Find all users with email matching 'test-milestone@fitapp.test'
 * - Remove them from all challenges
 * - Optionally delete the users from the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Challenge = require('./models/Challenge');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const User = require('./models/User');
const ChatMessage = require('./models/ChatMessage');

// MongoDB connection
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
};

// Main cleanup function
const cleanupTestUsers = async () => {
  try {
    console.log('🧹 Starting cleanup of test users...\n');
    
    // Connect to MongoDB
    await connectMongo();
    
    // Find all test users (by email pattern)
    const testUsers = await User.find({
      email: { $regex: /test-milestone@fitapp\.test/i }
    });
    
    console.log(`Found ${testUsers.length} test user(s) to clean up:\n`);
    
    for (const testUser of testUsers) {
      console.log(`👤 Processing: ${testUser.name || testUser.email} (${testUser.googleId})`);
      
      // Find all challenges this user is in
      const participants = await ChallengeParticipant.find({
        userId: testUser.googleId
      });
      
      console.log(`   Found ${participants.length} challenge(s) to remove from`);
      
      for (const participant of participants) {
        const challenge = await Challenge.findById(participant.challengeId);
        
        if (challenge) {
          console.log(`   📋 Removing from challenge: ${challenge.name} (${challenge.challengeCode || 'no code'})`);
          
          // Remove from challenge participants array
          if (challenge.participants.includes(testUser.email)) {
            challenge.participants = challenge.participants.filter(email => email !== testUser.email);
            await challenge.save();
            console.log(`      ✅ Removed from challenge participants array`);
          }
          
          // Add leave message from bot
          const botName = challenge.botName || 'Fitness Motivator';
          const userName = testUser.name || testUser.email;
          const leaveMessageText = `${userName} has left the ${challenge.name} challenge. We'll miss you!`;
          
          const leaveMessage = new ChatMessage({
            challengeId: challenge._id.toString(),
            sender: botName,
            message: leaveMessageText,
            isBot: true,
            isSystem: false,
            timestamp: new Date()
          });
          await leaveMessage.save();
          console.log(`      ✅ Added leave message from bot`);
        }
        
        // Delete participant record
        await ChallengeParticipant.findByIdAndDelete(participant._id);
        console.log(`      ✅ Deleted ChallengeParticipant record`);
      }
      
      // Optionally delete the user (commented out by default)
      // Uncomment the following lines if you want to delete the users entirely
      /*
      await User.findByIdAndDelete(testUser._id);
      console.log(`   ✅ Deleted user from database`);
      */
      
      console.log('');
    }
    
    console.log('✅ Cleanup complete!');
    console.log('\n💡 Note: Test users were removed from challenges but not deleted from the database.');
    console.log('   To delete users entirely, uncomment the deletion code in the script.');
    
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    console.error(err.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('\n✅ MongoDB connection closed');
  }
};

// Run cleanup
cleanupTestUsers().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

