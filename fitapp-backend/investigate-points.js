#!/usr/bin/env node

const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const User = require('./models/User');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp';

async function investigatePoints() {
  try {
    console.log('�� Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const challengeId = '6896b45176d78ebc85d22bf7';
    
    console.log('\n🔍 INVESTIGATING POINTS ISSUE FOR dbop1414');
    console.log('==========================================');

    // 1. Find all participants for this challenge
    console.log('\n1️⃣ ALL PARTICIPANTS IN CHALLENGE:');
    const allParticipants = await ChallengeParticipant.find({ challengeId });
    console.log(`Found ${allParticipants.length} participants:`);
    
    allParticipants.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.userId} - Points: ${p.points}, StepGoal: ${p.stepGoalPoints}, WeightLoss: ${p.weightLossPoints || 0}`);
    });

    // 2. Find specific user records for dbop1414
    console.log('\n2️⃣ LOOKING FOR dbop1414 RECORDS:');
    const dbop1414UserId = '117500098485701316317';
    const dbop1414Records = await ChallengeParticipant.find({ 
      challengeId, 
      userId: dbop1414UserId 
    });
    
    if (dbop1414Records.length === 0) {
      console.log('❌ No ChallengeParticipant records found for dbop1414');
    } else if (dbop1414Records.length === 1) {
      console.log('✅ Found 1 ChallengeParticipant record for dbop1414:');
      const record = dbop1414Records[0];
      console.log(`   Points: ${record.points}`);
      console.log(`   Step Goal Points: ${record.stepGoalPoints}`);
      console.log(`   Weight Loss Points: ${record.weightLossPoints || 0}`);
      console.log(`   Step Goal Days Achieved: ${record.stepGoalDaysAchieved || 0}`);
      console.log(`   Starting Weight: ${record.startingWeight}`);
      console.log(`   Last Weight: ${record.lastWeight}`);
      console.log(`   Last Step Count: ${record.lastStepCount}`);
      console.log(`   Last Step Date: ${record.lastStepDate}`);
      console.log(`   Created: ${record.createdAt}`);
      console.log(`   Updated: ${record.updatedAt}`);
      
      const expectedPoints = (record.stepGoalPoints || 0) + (record.weightLossPoints || 0);
      console.log(`\n   📊 POINTS BREAKDOWN:`);
      console.log(`   Step Goal Points: ${record.stepGoalPoints || 0}`);
      console.log(`   Weight Loss Points: ${record.weightLossPoints || 0}`);
      console.log(`   Expected Total: ${expectedPoints}`);
      console.log(`   Actual Total: ${record.points}`);
      console.log(`   Difference: ${record.points - expectedPoints}`);
      
    } else {
      console.log(`⚠️ Found ${dbop1414Records.length} ChallengeParticipant records for dbop1414 (DUPLICATES!):`);
      dbop1414Records.forEach((record, index) => {
        console.log(`   Record ${index + 1}:`);
        console.log(`     Points: ${record.points}`);
        console.log(`     Step Goal Points: ${record.stepGoalPoints}`);
        console.log(`     Weight Loss Points: ${record.weightLossPoints || 0}`);
        console.log(`     ID: ${record._id}`);
        console.log(`     Created: ${record.createdAt}`);
      });
      
      const totalPoints = dbop1414Records.reduce((sum, record) => sum + (record.points || 0), 0);
      console.log(`\n   📊 TOTAL POINTS ACROSS ALL RECORDS: ${totalPoints}`);
    }

    console.log('\n🔍 Investigation complete!');

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

investigatePoints();
