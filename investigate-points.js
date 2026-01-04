#!/usr/bin/env node

/**
 * Points Investigation Script
 * 
 * This script helps investigate why dbop1414 has 102 points instead of 7
 * Run this in your backend directory to debug the points issue
 */

const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const User = require('./models/User');

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';

async function investigatePoints() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const challengeId = '6896b45176d78ebc85d22bf7'; // Your challenge ID
    
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
      
      // Calculate expected points
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
      
      // Check if points are being summed incorrectly
      const totalPoints = dbop1414Records.reduce((sum, record) => sum + (record.points || 0), 0);
      console.log(`\n   📊 TOTAL POINTS ACROSS ALL RECORDS: ${totalPoints}`);
    }

    // 3. Check for any other records with this userId
    console.log('\n3️⃣ CHECKING FOR OTHER RECORDS WITH SAME USER ID:');
    const allDbop1414Records = await ChallengeParticipant.find({ userId: dbop1414UserId });
    console.log(`Found ${allDbop1414Records.length} total ChallengeParticipant records for userId: ${dbop1414UserId}`);
    
    if (allDbop1414Records.length > 1) {
      console.log('⚠️ Multiple ChallengeParticipant records found across different challenges:');
      allDbop1414Records.forEach((record, index) => {
        console.log(`   Record ${index + 1}: Challenge ${record.challengeId}, Points: ${record.points}`);
      });
    }

    // 4. Check User model for any additional data
    console.log('\n4️⃣ CHECKING USER MODEL FOR dbop1414:');
    const user = await User.findOne({ googleId: dbop1414UserId });
    if (user) {
      console.log('✅ Found user record:');
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Steps: ${user.steps}`);
      console.log(`   Weight: ${user.weight}`);
      console.log(`   Last Sync: ${user.lastSync}`);
    } else {
      console.log('❌ No user record found for this Google ID');
    }

    // 5. Check for any aggregation issues
    console.log('\n5️⃣ CHECKING FOR AGGREGATION ISSUES:');
    const aggregationResult = await ChallengeParticipant.aggregate([
      { $match: { challengeId, userId: dbop1414UserId } },
      { $group: { 
        _id: null, 
        totalPoints: { $sum: '$points' },
        totalStepGoalPoints: { $sum: '$stepGoalPoints' },
        totalWeightLossPoints: { $sum: '$weightLossPoints' },
        recordCount: { $sum: 1 }
      }}
    ]);
    
    if (aggregationResult.length > 0) {
      const result = aggregationResult[0];
      console.log('📊 AGGREGATION RESULTS:');
      console.log(`   Record Count: ${result.recordCount}`);
      console.log(`   Total Points: ${result.totalPoints}`);
      console.log(`   Total Step Goal Points: ${result.totalStepGoalPoints}`);
      console.log(`   Total Weight Loss Points: ${result.totalWeightLossPoints}`);
    }

    // 6. Recommendations
    console.log('\n6️⃣ RECOMMENDATIONS:');
    if (dbop1414Records.length > 1) {
      console.log('🚨 ISSUE: Multiple ChallengeParticipant records found');
      console.log('   SOLUTION: Remove duplicate records, keep only one');
      console.log('   COMMAND: db.challengeparticipants.deleteMany({ challengeId: "CHALLENGE_ID", userId: "USER_ID" })');
    } else if (dbop1414Records.length === 1) {
      const record = dbop1414Records[0];
      const expectedPoints = (record.stepGoalPoints || 0) + (record.weightLossPoints || 0);
      
      if (record.points !== expectedPoints) {
        console.log('🚨 ISSUE: Points mismatch detected');
        console.log(`   Expected: ${expectedPoints}, Actual: ${record.points}`);
        console.log('   SOLUTION: Reset points to correct value');
        console.log(`   COMMAND: db.challengeparticipants.updateOne({ _id: ObjectId("${record._id}") }, { $set: { points: ${expectedPoints} } })`);
      } else {
        console.log('✅ Points calculation appears correct');
      }
    }

    console.log('\n🔍 Investigation complete!');

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigatePoints();
