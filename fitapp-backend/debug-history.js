const mongoose = require('mongoose');
process.env.TZ = 'America/New_York';
const FitnessHistory = require('./models/FitnessHistory');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp');
  
  const userEmail = 'herringrick14@gmail.com'; // user from logs
  // actually user 105044462574652357380 is dbop14@gmail.com?
  // Log says: user 105044462574652357380 ... { oldStepPoints: 17, newStepPoints: 23 ... }
  // Let's search by userId 105044462574652357380
  
  const userId = '105044462574652357380';
  
  console.log(`Dumping history for ${userId}...`);
  
  const history = await FitnessHistory.find({ userId }).sort({ date: 1 });
  
  history.forEach(h => {
    console.log(`ID: ${h._id}, Date: ${h.date.toISOString()} (Local: ${h.date.toString()}), Steps: ${h.steps}, Source: ${h.source}`);
  });
  
  await mongoose.disconnect();
}

main();