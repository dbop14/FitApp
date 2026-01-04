const mongoose = require('mongoose');

const FitnessHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Google ID
  date: { type: Date, required: true, index: true }, // Date (normalized to start of day)
  steps: { type: Number, default: 0 },
  weight: { type: Number }, // Weight in lbs (can be null if not recorded that day)
  source: { type: String, enum: ['google-fit', 'manual', 'sync'], default: 'sync' }, // How the data was obtained
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure one entry per user per day
FitnessHistorySchema.index({ userId: 1, date: 1 }, { unique: true });

// Method to normalize date to start of day
FitnessHistorySchema.statics.normalizeDate = function(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  normalized.setMilliseconds(0);
  return normalized;
};

module.exports = mongoose.model('FitnessHistory', FitnessHistorySchema);
