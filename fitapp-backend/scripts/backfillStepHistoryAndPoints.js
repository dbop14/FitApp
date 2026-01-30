const mongoose = require('mongoose');

// Ensure the script runs in New York timezone
process.env.TZ = 'America/New_York';

const FitnessHistory = require('../models/FitnessHistory');
const Challenge = require('../models/Challenge');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const { ensureValidGoogleTokens } = require('../utils/googleAuth');
const { ensureValidFitbitTokens } = require('../utils/fitbitAuth');

/**
 * Normalize a JS Date to start-of-day using the same helper as the model.
 */
function normalizeDate(date) {
  return FitnessHistory.normalizeDate(date);
}

/**
 * Safely upsert a fitness history entry, merging with any existing duplicates
 * in a ±12h window (delete legacy/loose matches only). Backfill uses the
 * current API response as source of truth (no High Water Mark here).
 */
async function smartUpsertFitnessHistory(userId, date, steps, weight, source) {
    const canonicalDate = date;
    const startWindow = new Date(canonicalDate);
    startWindow.setHours(startWindow.getHours() - 12);
    const endWindow = new Date(canonicalDate);
    endWindow.setHours(endWindow.getHours() + 12);

    const candidates = await FitnessHistory.find({
        userId,
        date: { $gte: startWindow, $lte: endWindow }
    });

    const exactMatches = candidates.filter(c => c.date.getTime() === canonicalDate.getTime());
    const looseMatches = candidates.filter(c => c.date.getTime() !== canonicalDate.getTime());

    // Always use incoming API data as source of truth for backfill (no HWM)
    const stepsToSave = steps || 0;
    let weightToSave = weight;
    if ((weightToSave === undefined || weightToSave === null) && exactMatches.length > 0 && exactMatches[0].weight) {
        weightToSave = exactMatches[0].weight;
    }

    if (looseMatches.length > 0) {
        await FitnessHistory.deleteMany({ _id: { $in: looseMatches.map(c => c._id) } });
    }

    if (exactMatches.length > 0) {
        await FitnessHistory.findByIdAndUpdate(exactMatches[0]._id, {
            steps: stepsToSave,
            weight: weightToSave ?? null,
            source,
            updatedAt: new Date()
        });
        if (exactMatches.length > 1) {
            await FitnessHistory.deleteMany({ _id: { $in: exactMatches.slice(1).map(c => c._id) } });
        }
    } else {
        await FitnessHistory.create({
            userId,
            date: canonicalDate,
            steps: stepsToSave,
            weight: weightToSave ?? null,
            source,
            updatedAt: new Date(),
            createdAt: new Date()
        });
    }
}

/**
 * Format a date as YYYY-MM-DD using the local timezone.
 */
function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the challenge date range as Date objects (normalized to day boundaries).
 * Challenge model stores dates as strings.
 */
function getChallengeDateRange(challenge) {
  let start = null;
  let end = null;

  if (challenge.startDate) {
    // If it is just a date string "YYYY-MM-DD", treat as local midnight
    // (Appending T00:00:00 ensures it parses as local time instead of UTC)
    const ds = challenge.startDate.length === 10 ? challenge.startDate + 'T00:00:00' : challenge.startDate;
    start = normalizeDate(new Date(ds));
  }

  if (challenge.endDate) {
    // Treat endDate as inclusive; set to end of that calendar day
    const ds = challenge.endDate.length === 10 ? challenge.endDate + 'T00:00:00' : challenge.endDate;
    end = new Date(ds);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Sync last N days of step history for a Google Fit user into FitnessHistory.
 * This uses the Google Fit aggregate API similar to /api/user/userdata but:
 * - Uses a caller-provided date range
 * - Writes entries even when steps === 0 (explicit 0 days)
 */
async function syncGoogleFitHistoryForUser(user, daysBack = 30) {
  if (!user.accessToken) {
    console.log(`⚠️ Skipping Google Fit history sync for ${user.email} - no access token`);
    return;
  }

  try {
    const { oauth2Client } = await ensureValidGoogleTokens(user);

    const now = new Date();
    // Force "now" to interpret current time in the correct timezone context if needed,
    // though process.env.TZ handles the system time offset.
    const start = new Date(now);
    start.setDate(start.getDate() - (daysBack - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const credentials = await oauth2Client.getAccessToken();
    const accessToken = credentials.token || user.accessToken;

    console.log(`📡 Syncing Google Fit history for ${user.email} from ${start.toString()} (${start.toISOString()}) to ${end.toString()}`);

    const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google Fit history API error for ${user.email}: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    if (!data.bucket || data.bucket.length === 0) {
      console.log(`ℹ️ No Google Fit buckets returned for ${user.email}`);
      return;
    }

    // Cleanup removed to support High Water Mark logic.
    // Timezone alignment is now fixed via process.env.TZ, so duplicates shouldn't occur.
    // findOneAndUpdate with consistent date normalization handles upserts correctly.

    for (const bucket of data.bucket) {
      const rawNanos = bucket.startTimeMillisNanos;
      const rawMillis = bucket.startTimeMillis;

      let bucketStartMillis;
      if (rawMillis !== undefined && rawMillis !== null) {
        bucketStartMillis = typeof rawMillis === 'string' ? parseInt(rawMillis, 10) : rawMillis;
      } else if (rawNanos !== undefined && rawNanos !== null) {
        const nanos = typeof rawNanos === 'string' ? parseInt(rawNanos, 10) : rawNanos;
        const year2200InMillis = 7258118400000;
        if (nanos > year2200InMillis) {
          bucketStartMillis = nanos / 1000000;
        } else {
          bucketStartMillis = nanos;
        }
      } else {
        console.warn(`⚠️ Google Fit bucket missing timestamp fields for ${user.email}, skipping`, {
          hasNanos: rawNanos !== undefined,
          hasMillis: rawMillis !== undefined
        });
        continue;
      }

      if (!bucketStartMillis || isNaN(bucketStartMillis) || bucketStartMillis <= 0) {
        console.warn(`⚠️ Invalid Google Fit bucket timestamp for ${user.email}, skipping: ${bucketStartMillis}`);
        continue;
      }

      const bucketDateObj = new Date(bucketStartMillis);
      if (isNaN(bucketDateObj.getTime())) {
        console.warn(`⚠️ Invalid Date created from timestamp for ${user.email}, skipping`, {
          bucketStartMillis
        });
        continue;
      }

      // Use the bucket's UTC calendar date at midnight NY so one bucket = one stored day.
      // (normalizeDate(bucketDateObj) would treat UTC midnight as previous NY day and cause
      // duplicate/off-by-one counts when recalc runs.)
      const bucketDate = normalizeDate(new Date(
        bucketDateObj.getUTCFullYear(),
        bucketDateObj.getUTCMonth(),
        bucketDateObj.getUTCDate()
      ));

      const stepsData = bucket.dataset?.find(d =>
        d.dataTypeName === 'com.google.step_count.delta' ||
        d.dataSourceId?.includes('step_count.delta')
      );
      const steps = stepsData?.point?.[0]?.value?.[0]?.intVal ?? 0;

      // IMPORTANT: For history backfill we always write the day,
      // even when steps === 0 so we can distinguish "no data" vs "0 steps".
      
      // Use smart upsert to handle deduplication and High Water Mark
      await smartUpsertFitnessHistory(
        user.googleId,
        bucketDate,
        steps,
        undefined, // Google Fit aggregated steps endpoint doesn't return weight in this call
        'google-fit'
      );
    }

    console.log(`✅ Finished Google Fit history sync for ${user.email}`);
  } catch (error) {
    console.error(`❌ Error syncing Google Fit history for ${user.email}:`, error);
  }
}

/**
 * Sync last N days of step history for a Fitbit user into FitnessHistory.
 * Uses Fitbit time-series endpoints similar to fitbitService.syncFitbitHistory but:
 * - Writes entries even when steps === 0
 */
async function syncFitbitHistoryForUser(user, daysBack = 30) {
  if (!user.fitbitAccessToken) {
    console.log(`⚠️ Skipping Fitbit history sync for ${user.email} - no Fitbit access token`);
    return;
  }

  try {
    const { accessToken } = await ensureValidFitbitTokens(user);
    const fitbitUserId = user.fitbitUserId || '-';

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (daysBack - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);

    const startDateStr = formatDateYMD(start);
    const endDateStr = formatDateYMD(end);

    console.log(`📡 Syncing Fitbit history for ${user.email} from ${startDateStr} to ${endDateStr}`);

    // Cleanup removed to support High Water Mark logic.
    // Timezone alignment is now fixed via process.env.TZ, so duplicates shouldn't occur.

    const [stepsResponse, weightResponse] = await Promise.all([
      fetch(
        `https://api.fitbit.com/1/user/${fitbitUserId}/activities/steps/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      ),
      fetch(
        `https://api.fitbit.com/1/user/${fitbitUserId}/body/log/weight/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
    ]);

    let stepsData = null;
    if (stepsResponse.ok) {
      stepsData = await stepsResponse.json();
    } else if (stepsResponse.status !== 404) {
      console.warn(`⚠️ Failed to fetch Fitbit steps history for ${user.email}: ${stepsResponse.status}`);
    }

    let weightData = null;
    if (weightResponse.ok) {
      weightData = await weightResponse.json();
    } else if (weightResponse.status !== 404) {
      console.warn(`⚠️ Failed to fetch Fitbit weight history for ${user.email}: ${weightResponse.status}`);
    }

    const weightMap = new Map();
    if (weightData && Array.isArray(weightData.weight)) {
      weightData.weight.forEach(entry => {
        if (entry.date && entry.value !== undefined) {
          const weightValue = parseFloat(entry.value);
          let weightInLbs = weightValue;
          if (entry.unit === 'kg' || entry.unit === 'en_GB') {
            weightInLbs = Math.round(weightValue * 2.20462 * 100) / 100;
          }
          weightMap.set(entry.date, weightInLbs);
        }
      });
    }

    if (!stepsData || !stepsData['activities-steps']) {
      console.log(`ℹ️ No Fitbit steps time series for ${user.email}`);
      return;
    }

    for (const entry of stepsData['activities-steps']) {
      const entryDateStr = entry.dateTime;
      // Parse as local midnight to ensure it normalizes to the correct day
      const entryDate = normalizeDate(new Date(entryDateStr + 'T00:00:00'));
      const steps = entry.value ? parseInt(entry.value, 10) : 0;
      const weight = weightMap.get(entryDateStr) || null;

      // Always write the entry, even when steps === 0 and weight === null.
      // Use smart upsert to handle deduplication and High Water Mark
      await smartUpsertFitnessHistory(
        user.googleId,
        entryDate,
        steps,
        weight,
        'fitbit'
      );
    }

    console.log(`✅ Finished Fitbit history sync for ${user.email}`);
  } catch (error) {
    console.error(`❌ Error syncing Fitbit history for ${user.email}:`, error);
  }
}

/**
 * Recalculate step-based points for a participant using FitnessHistory.
 * - Counts days within the challenge range where steps >= challenge.stepGoal
 * - Updates stepGoalPoints, stepGoalDaysAchieved, points, and lastStepDate accordingly
 *
 * NOTE: This does not modify weightLossPoints; those are preserved as-is.
 */
async function recalcStepPointsForParticipant(participant, challenge) {
  const { start: challengeStart, end: challengeEnd } = getChallengeDateRange(challenge);

  if (!challengeStart) {
    console.log(`⚠️ Challenge ${challenge._id} has no valid startDate, skipping participant ${participant.userId}`);
    return;
  }

  const effectiveEnd = challengeEnd || new Date(); // If no end date, use "today"
  const stepGoalValue = challenge.stepGoal || 10000;
  const stepGoal = typeof stepGoalValue === 'string' ? parseInt(stepGoalValue, 10) : Number(stepGoalValue);

  const queryStart = normalizeDate(challengeStart);
  const queryEnd = effectiveEnd;
  const history = await FitnessHistory.find({
    userId: participant.userId,
    date: {
      $gte: queryStart,
      $lte: queryEnd
    }
  }).sort({ date: 1 });
  let goalDates = [];
  history.forEach(entry => {
    const steps = entry.steps || 0;
    if (steps >= stepGoal) {
      goalDates.push(normalizeDate(entry.date));
    }
  });

  // Deduplicate dates in case of any duplicates in history
  const uniqueGoalDateKeys = new Set(goalDates.map(d => d.toISOString()));
  const newStepGoalDays = uniqueGoalDateKeys.size;

  // Determine the last day where the goal was met
  let lastStepDate = null;
  if (goalDates.length > 0) {
    lastStepDate = goalDates[goalDates.length - 1];
  }

  const oldStepPoints = participant.stepGoalPoints || 0;
  const oldWeightLossPoints = participant.weightLossPoints || 0;
  
  // Recalculate weight loss points based on the most recent weight in history
  // This ensures that even if Sync messed up the weight loss calc, Backfill fixes it
  const mostRecentWeightEntry = await FitnessHistory.findOne(
    { userId: participant.userId, weight: { $ne: null } },
    {},
    { sort: { date: -1 } }
  );
  
  let newWeightLossPoints = participant.weightLossPoints || 0;
  
  if (mostRecentWeightEntry && mostRecentWeightEntry.weight && participant.startingWeight) {
    const currentWeight = mostRecentWeightEntry.weight;
    const totalWeightLost = participant.startingWeight - currentWeight;
    const totalPercentLost = Math.max(0, (totalWeightLost / participant.startingWeight) * 100);
    
    // Helper to round points (same as user.js)
    const roundWeightLossPoints = (percentage) => {
      const decimal = percentage % 1;
      if (decimal >= 0.5) {
        return Math.ceil(percentage);
      } else {
        return Math.floor(percentage);
      }
    };
    
    newWeightLossPoints = roundWeightLossPoints(totalPercentLost);
  }

  const newStepPoints = newStepGoalDays;
  const newTotalPoints = newStepPoints + newWeightLossPoints;

  participant.stepGoalPoints = newStepPoints;
  participant.stepGoalDaysAchieved = newStepGoalDays;
  participant.weightLossPoints = newWeightLossPoints; // Update this!
  participant.points = newTotalPoints;
  participant.lastStepDate = lastStepDate;

  await participant.save();

  console.log(`✅ Recalculated points for user ${participant.userId} in challenge ${challenge.name}:`, {
    oldStepPoints,
    newStepPoints,
    oldWeightLossPoints: oldWeightLossPoints,
    newWeightLossPoints,
    totalPoints: newTotalPoints
  });
}

async function backfillStepHistoryAndPoints() {
  console.log('🔧 Starting backfill of step history and points for challenge users...');
  const now = new Date();
  console.log(`🕒 Server Time Check: ${now.toString()}`);

  const participants = await ChallengeParticipant.find({});
  if (participants.length === 0) {
    console.log('ℹ️ No challenge participants found. Nothing to do.');
    return;
  }

  console.log(`📊 Found ${participants.length} challenge participants (all challenges)`);

  // Cache users and challenges so we don't query them repeatedly
  const userCache = new Map();
  const challengeCache = new Map();

  // Determine which challenges are currently active.
  // Active = today is on/after startDate, and (no endDate OR today is on/before endDate).
  const todayStart = normalizeDate(now);

  const allChallengeIds = Array.from(new Set(participants.map(p => p.challengeId)));
  const allChallenges = await Challenge.find({ _id: { $in: allChallengeIds } });

  const activeChallengeIds = new Set();
  allChallenges.forEach(challenge => {
    const { start, end } = getChallengeDateRange(challenge);
    if (!start) {
      return;
    }
    const isStarted = todayStart.getTime() >= normalizeDate(start).getTime();
    const isNotEnded = !end || todayStart.getTime() <= end.getTime();
    if (isStarted && isNotEnded) {
      activeChallengeIds.add(String(challenge._id));
      challengeCache.set(String(challenge._id), challenge);
    }
  });

  if (activeChallengeIds.size === 0) {
    console.log('ℹ️ No active challenges found based on start/end dates. Nothing to do.');
    return;
  }

  console.log(`📊 Active challenges: ${activeChallengeIds.size} (out of ${allChallengeIds.length} total challenges)`);

  // Filter participants down to only those in active challenges
  const activeParticipants = participants.filter(p => activeChallengeIds.has(String(p.challengeId)));

  if (activeParticipants.length === 0) {
    console.log('ℹ️ No participants in active challenges. Nothing to do.');
    return;
  }

  console.log(`📊 Found ${activeParticipants.length} participants in active challenges`);

  // First, build a distinct set of user IDs involved in challenges
  const userIds = Array.from(new Set(activeParticipants.map(p => p.userId)));

  console.log(`📊 Found ${userIds.length} distinct users in challenges`);

  // Load all users up front
  const users = await User.find({ googleId: { $in: userIds } });
  users.forEach(u => userCache.set(u.googleId, u));

  // Step 1 & 2: For each user (in active challenges), sync last 30 days of history
  // from their configured data source
  for (const userId of userIds) {
    const user = userCache.get(userId);
    if (!user) {
      console.log(`⚠️ User ${userId} not found, skipping history sync`);
      continue;
    }

    const dataSource = user.dataSource || 'google-fit';

    if (dataSource === 'fitbit') {
      await syncFitbitHistoryForUser(user, 30);
    } else {
      await syncGoogleFitHistoryForUser(user, 30);
    }
  }

  console.log('📊 Finished syncing history; now recalculating step points from FitnessHistory for active challenges...');

  // Step 3: Recalculate step-based points for each participant in active challenges
  for (const participant of activeParticipants) {
    const challengeId = participant.challengeId;

    let challenge = challengeCache.get(challengeId);
    if (!challenge) {
      challenge = await Challenge.findById(challengeId);
      if (!challenge) {
        console.log(`⚠️ Challenge ${challengeId} not found, skipping participant ${participant.userId}`);
        continue;
      }
      challengeCache.set(challengeId, challenge);
    }

    await recalcStepPointsForParticipant(participant, challenge);
  }

  console.log('✅ Backfill complete: step history synced and points recalculated for all challenge participants.');
}

// CLI entry point
async function main() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://mongoosedb:27017/fitapp';
    console.log(`🔌 Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    await backfillStepHistoryAndPoints();

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ backfillStepHistoryAndPoints failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = backfillStepHistoryAndPoints;

