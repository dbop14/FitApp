#!/usr/bin/env node

/**
 * Fix Points Script
 * 
 * This script fixes the points for dbop1414 once the issue is identified
 * Run this after running the investigation script
 */

const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';

async function fixPoints() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const challengeId = '6896b45176d78ebc85d22bf7';
    const dbop1414UserId = '117500098485701316317';
    const correctPoints = 7; // The correct point value

    console.log('\n🔧 FIXING POINTS FOR dbop1414');
    console.log('================================');

    // Find the record
    const record = await ChallengeParticipant.findOne({ 
      challengeId, 
      userId: dbop1414UserId 
    });

    if (!record) {
      console.log('❌ No record found for dbop1414');
      return;
    }

    console.log('📊 CURRENT RECORD:');
    console.log(`   Points: ${record.points} → ${correctPoints}`);
    console.log(`   Step Goal Points: ${record.stepGoalPoints}`);
    console.log(`   Weight Loss Points: ${record.weightLossPoints || 0}`);
    console.log(`   Record ID: ${record._id}`);

    // Update the points
    const result = await ChallengeParticipant.updateOne(
      { _id: record._id },
      { $set: { points: correctPoints } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Points updated successfully!');
      
      // Verify the update
      const updatedRecord = await ChallengeParticipant.findById(record._id);
      console.log('📊 UPDATED RECORD:');
      console.log(`   Points: ${updatedRecord.points}`);
      console.log(`   Step Goal Points: ${updatedRecord.stepGoalPoints}`);
      console.log(`   Weight Loss Points: ${updatedRecord.weightLossPoints || 0}`);
    } else {
      console.log('❌ Failed to update points');
    }

    // Check if there are duplicate records
    const allRecords = await ChallengeParticipant.find({ 
      challengeId, 
      userId: dbop1414UserId 
    });

    if (allRecords.length > 1) {
      console.log('\n⚠️ DUPLICATE RECORDS FOUND:');
      console.log(`   Found ${allRecords.length} records for the same user`);
      
      // Keep the first record, remove the rest
      const recordsToDelete = allRecords.slice(1);
      console.log(`   Removing ${recordsToDelete.length} duplicate record(s)`);
      
      for (const duplicateRecord of recordsToDelete) {
        console.log(`   Deleting record: ${duplicateRecord._id}`);
        await ChallengeParticipant.findByIdAndDelete(duplicateRecord._id);
      }
      
      console.log('✅ Duplicate records removed');
    }

    console.log('\n🔧 Points fix complete!');

  } catch (error) {
    console.error('❌ Error during points fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixPoints();
