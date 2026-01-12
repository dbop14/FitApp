#!/usr/bin/env node

const mongoose = require('mongoose');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const Challenge = require('./models/Challenge');
const User = require('./models/User');

async function directPointAdjustment() {
  const [,, userId, challengeCode, pointsToAdjustStr] = process.argv;

  if (!userId || !challengeCode || !pointsToAdjustStr) {
    console.error('❌ Usage: ./direct-point-adjustment.js <userId> <challengeCode> <points>');
    console.error('   Example: ./direct-point-adjustment.js 12345 FIT123 -1  (to remove 1 point)');
    process.exit(1);
  }

  const pointsToAdjust = parseInt(pointsToAdjustStr, 10);
  if (isNaN(pointsToAdjust)) {
    console.error('❌ Invalid points value. Must be a number.');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Find user and challenge for logging purposes
    const user = await User.findOne({ googleId: userId });
    const challenge = await Challenge.findOne({ challengeCode });

    if (!user) console.log(`🤷 User with ID ${userId} not found.`);
    else console.log(`🔥 Target User: ${user.name} (${userId})`);

    if (!challenge) {
      console.error(`❌ Challenge with code ${challengeCode} not found.`);
      return;
    }
    console.log(`🔥 Target Challenge: ${challenge.name} (${challenge.challengeCode})`);

    // 2. Find the challenge participant
    const participant = await ChallengeParticipant.findOne({
      challengeId: challenge._id.toString(),
      userId: userId
    });

    if (!participant) {
      console.error('❌ User is not a participant in this challenge.');
      return;
    }

    console.log('\n📊 Current Points:');
    console.log(`  - Total Points: ${participant.points}`);
    console.log(`  - Step Goal Points: ${participant.stepGoalPoints}`);
    
    // 3. Adjust points
    // We adjust both `points` (total) and `stepGoalPoints` as requested
    const newPoints = participant.points + pointsToAdjust;
    const newStepGoalPoints = participant.stepGoalPoints + pointsToAdjust;

    console.log(`\n🔧 Adjusting points by ${pointsToAdjust}...`);
    
    await ChallengeParticipant.updateOne(
      { _id: participant._id },
      { $set: { points: newPoints, stepGoalPoints: newStepGoalPoints } }
    );

    console.log('\n✅ Points updated successfully.');
    console.log('📊 New Points:');
    console.log(`  - Total Points: ${newPoints}`);
    console.log(`  - Step Goal Points: ${newStepGoalPoints}`);

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB.');
  }
}

directPointAdjustment();
