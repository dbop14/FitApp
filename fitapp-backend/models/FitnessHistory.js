const mongoose = require('mongoose');

const FitnessHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Google ID
  date: { type: Date, required: true, index: true }, // Date (normalized to start of day)
  steps: { type: Number, default: 0 },
  weight: { type: Number }, // Weight in lbs (can be null if not recorded that day)
  source: { type: String, enum: ['google-fit', 'fitbit', 'manual', 'sync'], default: 'sync' }, // How the data was obtained
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure one entry per user per day
FitnessHistorySchema.index({ userId: 1, date: 1 }, { unique: true });

// Method to normalize date to start of day
// Uses 'America/New_York' timezone to ensure consistency regardless of server TZ
FitnessHistorySchema.statics.normalizeDate = function(date) {
  // Convert to New York time string YYYY-MM-DD
  const nyDateStr = new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  // Create new Date from that string (interpreted as local midnight in NY context? No, we want absolute point)
  // Actually, we want to store the "Day" object.
  // Ideally we store UTC midnight for that day? Or NY Midnight?
  // Previous script used process.env.TZ='America/New_York' which means:
  // new Date() -> NY time. setHours(0,0,0,0) -> Midnight NY.
  // So we want to return a Date object representing Midnight New York.
  
  // Create a date object that represents that YYYY-MM-DD in New York
  // We can't easily construct "Midnight NY" as a Date object without a library like date-fns-tz
  // But we can hack it:
  // 1. Get YYYY, MM, DD in NY
  // 2. Construct Date(YYYY, MM-1, DD) assuming local time? No, server is UTC.
  // If server is UTC, new Date(2026, 0, 5) -> 2026-01-05 00:00 UTC.
  // But Midnight NY is 2026-01-05 05:00 UTC.
  
  // Robust approach:
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(d);
  const mapping = {};
  parts.forEach(p => mapping[p.type] = p.value);
  
  // Create Date object for Midnight NY of that day
  // We construct ISO string "YYYY-MM-DDT00:00:00.000-05:00" (approx)
  // Easier: construct string "YYYY-MM-DD" and interpret in NY.
  // But JS Date parsing is tricky.
  
  // Let's use the offset approach.
  // For a given date, find the offset of NY.
  // This is complex without a library.
  
  // ALTERNATIVE: Just use the 'en-CA' string (YYYY-MM-DD) and append "T00:00:00"
  // And parse it as if it were a local date, but adjust for the fact that we want consistent storage.
  // If we store everything as UTC Midnight, it's consistent.
  // But the user WANTS New York.
  
  // If we assume the container MIGHT be UTC, but we WANT NY behavior:
  // We should emulate what 'process.env.TZ = America/New_York' does.
  // It shifts the "start of day" to be 05:00 UTC (or 04:00 DST).
  
  // Since I don't have moment-timezone, I will use a simple heuristic:
  // Use .toLocaleString('en-US', { timeZone: 'America/New_York' }) to identify the day.
  // Then construct a Date that represents Midnight of that day in NY.
  
  // However, simpler fix for NOW:
  // Just use the same logic as the script: rely on the environment.
  // BUT the environment is WRONG (UTC).
  // So I MUST set the environment variable in the application code too?
  // Changing process.env.TZ at runtime in a running Express app is risky/undefined behavior for some libs.
  
  // Better: Update `normalizeDate` to be timezone-aware manually.
  
  const tz = 'America/New_York';
  const format = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: tz
  });
  const [{ value: mo }, , { value: da }, , { value: ye }] = format.formatToParts(new Date(date));
  
  // Construct ISO string for midnight in that timezone
  // Note: we don't know if it's -05:00 or -04:00 without more logic.
  // But we can iterate.
  
  // SIMPLIFICATION:
  // Just enforce UTC storage for dates?
  // No, that shifts the "day" boundary.
  
  // Let's go with this:
  // 1. Get the YYYY-MM-DD string in NY time.
  // 2. Create a UTC date for that YYYY-MM-DD (e.g. 2026-01-05T00:00:00Z).
  // 3. Store THAT.
  // This means "Day 5" is stored as "Jan 5 00:00 UTC".
  // This is stable.
  // BUT... my backfill script (running with TZ=NY) stored "Jan 5 00:00 NY" (05:00 UTC).
  // So they will differ by 5 hours.
  
  // I need to match the backfill script (NY Midnight).
  // So I need to produce 05:00 UTC (for standard time).
  
  // Actually, the user asked to "ensure ... is using the same time zone? New York".
  // If I change the model, I change it for EVERYONE.
  // Is this app only for this user? "fitapp". Seems single-tenant or small group.
  
  // I will inject `process.env.TZ = 'America/New_York'` at the very top of `index.js` (entry point).
  // This ensures the whole backend runs in NY time, matching the script and the user's intent.
  
  return normalized;
};

module.exports = mongoose.model('FitnessHistory', FitnessHistorySchema);
