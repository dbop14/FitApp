#!/usr/bin/env node

const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');

async function fixPoints() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');

    const challengeId = '6896b45176d78ebc85d22bf7';
    const dbop1414UserId = '117500098485701316317';
    const correctPoints = 7; // 2 (step goal) + 5 (weight loss)

    console.log('\n🔧 FIXING POINTS FOR dbop1414');
    console.log('================================');

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

    const result = await ChallengeParticipant.updateOne(
      { _id: record._id },
      { $set: { points: correctPoints } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Points updated successfully!');
      
      const updatedRecord = await ChallengeParticipant.findById(record._id);
      console.log('📊 UPDATED RECORD:');
      console.log(`   Points: ${updatedRecord.points}`);
      console.log(`   Step Goal Points: ${updatedRecord.stepGoalPoints}`);
      console.log(`   Weight Loss Points: ${updatedRecord.weightLossPoints || 0}`);
    } else {
      console.log('❌ Failed to update points');
    }

    console.log('\n🔧 Points fix complete!');

  } catch (error) {
    console.error('❌ Error during points fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixPoints();
