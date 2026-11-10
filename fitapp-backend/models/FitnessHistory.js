const mongoose = require('mongoose');

const FitnessHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Google ID
  date: { type: Date, required: true, index: true }, // Date (normalized to start of day)
  steps: { type: Number, default: 0 },
  weight: { type: Number }, // Weight in lbs (can be null if not recorded that day)
  source: { type: String, enum: ['google-fit', 'fitbit', 'manual', 'sync', 'google-health', 'whoop'], default: 'sync' }, // How the data was obtained
  // Points v2 (additive; absent on existing documents).
  effortPoints: { type: Number }, // from workouts of 10+ minutes: 1 per moderate minute, 2 per vigorous
  moderateMinutes: { type: Number },
  vigorousMinutes: { type: Number },
  strengthSessions: { type: Number }, // strength sessions of 20+ minutes that day
  finalized: { type: Boolean }, // set 48h after the day ends; locks the activity fields above and steps
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

// Finalized days are locked: steps and the v2 activity fields can no longer change.
// Weight stays writable (weigh-in readings remain the authority).
const LOCKED_FIELDS = ['steps', 'effortPoints', 'moderateMinutes', 'vigorousMinutes', 'strengthSessions'];
FitnessHistorySchema.statics.LOCKED_FIELDS = LOCKED_FIELDS;

async function dropWritesToFinalizedDays() {
  const update = this.getUpdate();
  if (!update || this.getOptions().allowFinalizedWrite) return;
  const touches = (obj) => obj && LOCKED_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(obj, f));
  if (!touches(update) && !touches(update.$set) && !touches(update.$inc)) return;
  const existing = await this.model.findOne(this.getFilter()).select('finalized').lean();
  if (!existing || !existing.finalized) return;
  for (const f of LOCKED_FIELDS) {
    delete update[f];
    if (update.$set) delete update.$set[f];
    if (update.$inc) delete update.$inc[f];
  }
  this.setUpdate(update);
}
FitnessHistorySchema.pre('findOneAndUpdate', dropWritesToFinalizedDays);
FitnessHistorySchema.pre('updateOne', dropWritesToFinalizedDays);

FitnessHistorySchema.post('init', function (doc) {
  doc.$locals.lockedOriginal = Object.fromEntries(LOCKED_FIELDS.map((f) => [f, doc[f]]));
});
FitnessHistorySchema.pre('save', function (next) {
  if (!this.isNew && this.finalized && !this.$locals.allowFinalizedWrite && this.$locals.lockedOriginal) {
    for (const f of LOCKED_FIELDS) {
      if (this.isModified(f)) this.set(f, this.$locals.lockedOriginal[f]);
    }
  }
  next();
});

module.exports = mongoose.model('FitnessHistory', FitnessHistorySchema);
