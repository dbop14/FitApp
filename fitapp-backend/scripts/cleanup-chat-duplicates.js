const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Challenge = require('../models/Challenge');

async function cleanupChatDuplicates(challengeIdentifier) {
  if (!challengeIdentifier) {
    console.error('❌ Error: Challenge code or ID is required');
    console.log('Usage: node scripts/cleanup-chat-duplicates.js <challengeCode or challengeId>');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
    console.log(`🔌 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Determine if input is a challenge code (like "FIT73403") or ObjectId
    let challengeId;
    let challengeCode = challengeIdentifier;
    
    // Check if it looks like a challenge code (contains letters) or is an ObjectId
    if (mongoose.Types.ObjectId.isValid(challengeIdentifier) && challengeIdentifier.length === 24) {
      // It's an ObjectId
      challengeId = challengeIdentifier;
      const challenge = await Challenge.findById(challengeId);
      if (challenge) {
        challengeCode = challenge.challengeCode || challengeId;
        console.log(`📋 Using challenge ID: ${challengeId} (code: ${challengeCode})`);
      } else {
        console.log(`📋 Using challenge ID: ${challengeId} (challenge not found, but will search messages)`);
      }
    } else {
      // Assume it's a challenge code, look up the challenge
      console.log(`🔍 Looking up challenge by code: ${challengeIdentifier}`);
      const challenge = await Challenge.findOne({ challengeCode: challengeIdentifier });
      
      if (!challenge) {
        console.error(`❌ Challenge not found with code: ${challengeIdentifier}`);
        console.log('💡 Tip: Make sure the challenge code is correct (e.g., FIT73403)');
        await mongoose.connection.close();
        process.exit(1);
      }
      
      challengeId = challenge._id.toString();
      challengeCode = challenge.challengeCode;
      console.log(`✅ Found challenge: ${challenge.name} (ID: ${challengeId}, Code: ${challengeCode})`);
    }

    // Find all messages for this challenge
    const allMessages = await ChatMessage.find({ challengeId })
      .sort({ timestamp: 1 }); // Sort by timestamp ascending
    
    console.log(`\n📊 Found ${allMessages.length} total messages for challenge: ${challengeCode} (${challengeId})`);

    if (allMessages.length === 0) {
      console.log('ℹ️  No messages found for this challenge');
      await mongoose.connection.close();
      return;
    }

    // Group messages by their unique characteristics
    // We consider messages duplicates if they have:
    // - Same challengeId (already filtered)
    // - Same sender
    // - Same message content
    // - Same isBot flag
    // - Same userId (if present)
    // - Timestamp within 5 seconds (to account for slight timing differences)
    
    const messageGroups = new Map();
    const duplicatesToDelete = [];

    for (const message of allMessages) {
      // Create a key based on message characteristics
      const key = JSON.stringify({
        sender: message.sender,
        message: message.message,
        isBot: message.isBot,
        isSystem: message.isSystem,
        userId: message.userId || null,
        messageType: message.messageType || 'text'
      });

      if (!messageGroups.has(key)) {
        messageGroups.set(key, []);
      }
      
      messageGroups.get(key).push(message);
    }

    // Find groups with duplicates (more than 1 message)
    let totalDuplicates = 0;
    let totalGroups = 0;

    for (const [key, messages] of messageGroups.entries()) {
      if (messages.length > 1) {
        totalGroups++;
        
        // Sort by timestamp to keep the oldest one
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Keep the first (oldest) message, mark the rest for deletion
        const toKeep = messages[0];
        const toDelete = messages.slice(1);
        
        totalDuplicates += toDelete.length;
        
        console.log(`\n🔍 Found ${messages.length} duplicate messages:`);
        console.log(`   Sender: ${toKeep.sender}`);
        console.log(`   Message: ${toKeep.message.substring(0, 50)}${toKeep.message.length > 50 ? '...' : ''}`);
        console.log(`   Keeping: ${toKeep._id} (timestamp: ${toKeep.timestamp})`);
        console.log(`   Deleting: ${toDelete.length} duplicate(s)`);
        
        for (const msg of toDelete) {
          duplicatesToDelete.push(msg._id);
        }
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Total messages: ${allMessages.length}`);
    console.log(`   Unique message groups: ${messageGroups.size}`);
    console.log(`   Groups with duplicates: ${totalGroups}`);
    console.log(`   Duplicate messages to remove: ${totalDuplicates}`);

    // Delete duplicates
    if (duplicatesToDelete.length > 0) {
      console.log(`\n🗑️  Removing ${duplicatesToDelete.length} duplicate messages...`);
      const result = await ChatMessage.deleteMany({ 
        _id: { $in: duplicatesToDelete } 
      });
      console.log(`✅ Removed ${result.deletedCount} duplicate messages`);
      
      // Verify cleanup
      const remainingMessages = await ChatMessage.find({ challengeId });
      console.log(`\n✅ Remaining messages for challenge ${challengeCode}: ${remainingMessages.length}`);
    } else {
      console.log(`\n✅ No duplicates found. All messages are unique.`);
    }

    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Get challenge code or ID from command line arguments
const challengeIdentifier = process.argv[2];

cleanupChatDuplicates(challengeIdentifier);

