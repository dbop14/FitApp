const mongoose = require('mongoose');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');

async function main() {
  const [,, userEmail, challengeCode] = process.argv;
  if (!userEmail || !challengeCode) {
    console.error('Usage: node addParticipant.js <userEmail> <challengeCode>');
    process.exit(1);
  }

  await mongoose.connect('mongodb://localhost:27017/fitapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const user = await User.findOne({ email: userEmail });
  if (!user) {
    console.error('User not found:', userEmail);
    process.exit(1);
  }

  const challenge = await Challenge.findOne({ challengeCode });
  if (!challenge) {
    console.error('Challenge not found:', challengeCode);
    process.exit(1);
  }

  // Check if already a participant
  const existing = await ChallengeParticipant.findOne({ challengeId: String(challenge._id), userId: String(user._id) });
  if (existing) {
    console.log('User is already a participant in this challenge.');
    process.exit(0);
  }

  const participant = new ChallengeParticipant({
    challengeId: String(challenge._id),
    userId: String(user._id),
    startingWeight: user.weight || 0,
    lastWeight: user.weight || 0,
    lastStepDate: user.lastSync || new Date(),
    lastStepCount: user.steps || 0,
    points: 0
  });
  await participant.save();
  console.log(`Added ${user.email} as a participant to challenge '${challenge.name}' (${challenge.challengeCode})`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});