const mongoose = require('mongoose');
const User = require('./models/User');
const ChallengeParticipant = require('./models/ChallengeParticipant');
const Challenge = require('./models/Challenge');

async function removeUserFromChallenges() {
  try {
    await mongoose.connect('mongodb://mongoosedb:27017/fitapp');
    console.log('Connected to MongoDB');
    
    // Find the user
    const user = await User.findOne({ email: 'dbop1414@gmail.com' });
    if (!user) {
      console.log('User dbop1414@gmail.com not found');
      return;
    }
    console.log('Found user:', user.email, 'Google ID:', user.googleId);
    
    // Find all challenges this user is participating in
    const participants = await ChallengeParticipant.find({ userId: user.googleId });
    console.log('User is participating in', participants.length, 'challenges:');
    
    for (const participant of participants) {
      const challenge = await Challenge.findById(participant.challengeId);
      console.log('- Challenge:', challenge?.name || 'Unknown', 'ID:', participant.challengeId);
      
      // Remove participant record
      await ChallengeParticipant.findByIdAndDelete(participant._id);
      console.log('  ✅ Removed participant record');
      
      // Update challenge participants array
      if (challenge && challenge.participants.includes(user.email)) {
        challenge.participants = challenge.participants.filter(email => email !== user.email);
        await challenge.save();
        console.log('  ✅ Updated challenge participants array');
      }
    }
    
    console.log('✅ Successfully removed user from all challenges');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

removeUserFromChallenges(); 