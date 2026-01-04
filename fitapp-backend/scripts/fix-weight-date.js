// Script to fix the date of an existing manual weight entry
// Usage: node scripts/fix-weight-date.js

const mongoose = require('mongoose');
const FitnessHistory = require('../models/FitnessHistory');

const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
const userId = '105044462574652357380';
const oldDateStr = '2026-01-04';
const newDateStr = '2026-01-03';

async function fixWeightDate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const oldDate = FitnessHistory.normalizeDate(new Date(oldDateStr + 'T00:00:00'));
    const newDate = FitnessHistory.normalizeDate(new Date(newDateStr + 'T00:00:00'));

    console.log(`🔍 Looking for entry: userId=${userId}, date=${oldDateStr}, source=manual`);
    
    // Find the entry with the old date
    const oldEntry = await FitnessHistory.findOne({
      userId: userId,
      date: oldDate,
      source: 'manual'
    });

    if (!oldEntry) {
      console.log('❌ No manual entry found for', oldDateStr);
      process.exit(1);
    }

    console.log(`✅ Found entry: weight=${oldEntry.weight} lbs, date=${oldEntry.date.toISOString()}`);

    // Check if there's already an entry for the new date
    const existingNewEntry = await FitnessHistory.findOne({
      userId: userId,
      date: newDate
    });

    if (existingNewEntry && existingNewEntry.source === 'manual') {
      console.log(`⚠️ Entry already exists for ${newDateStr}, updating it...`);
      existingNewEntry.weight = oldEntry.weight;
      existingNewEntry.source = 'manual';
      existingNewEntry.updatedAt = new Date();
      await existingNewEntry.save();
      
      // Delete the old entry
      await FitnessHistory.deleteOne({ _id: oldEntry._id });
      console.log(`✅ Updated entry for ${newDateStr} and deleted entry for ${oldDateStr}`);
    } else {
      // Create new entry with the new date, or update existing non-manual entry
      const newEntry = await FitnessHistory.findOneAndUpdate(
        { userId: userId, date: newDate },
        {
          $set: {
            weight: oldEntry.weight,
            source: 'manual',
            updatedAt: new Date()
          },
          $setOnInsert: {
            steps: existingNewEntry?.steps || 0,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      // Delete the old entry
      await FitnessHistory.deleteOne({ _id: oldEntry._id });
      console.log(`✅ Moved entry from ${oldDateStr} to ${newDateStr} with weight ${oldEntry.weight} lbs`);
    }

    // Verify the fix
    const verifyEntry = await FitnessHistory.findOne({
      userId: userId,
      date: newDate,
      source: 'manual',
      weight: oldEntry.weight
    });

    if (verifyEntry) {
      console.log(`✅ Verification: Entry now exists for ${newDateStr} with weight ${verifyEntry.weight} lbs`);
    } else {
      console.log(`❌ Verification failed: Entry not found for ${newDateStr}`);
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixWeightDate();

