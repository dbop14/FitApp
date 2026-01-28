const mongoose = require('mongoose');
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
 * Get the challenge date range as Date objects (normalized to day boundaries).
 * Challenge model stores dates as strings.
 */
function getChallengeDateRange(challenge) {
  let start = null;
  let end = null;

  if (challenge.startDate) {
    start = normalizeDate(new Date(challenge.startDate));
  }

  if (challenge.endDate) {
    // Treat endDate as inclusive; set to end of that calendar day
    end = new Date(challenge.endDate);
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
    const start = new Date(now);
    start.setDate(start.getDate() - (daysBack - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);

    const credentials = await oauth2Client.getAccessToken();
    const accessToken = credentials.token || user.accessToken;

    console.log(`📡 Syncing Google Fit history for ${user.email} from ${start.toISOString()} to ${end.toISOString()}`);

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

      const bucketDate = normalizeDate(bucketDateObj);

      const stepsData = bucket.dataset?.find(d =>
        d.dataTypeName === 'com.google.step_count.delta' ||
        d.dataSourceId?.includes('step_count.delta')
      );
      const steps = stepsData?.point?.[0]?.value?.[0]?.intVal ?? 0;

      // IMPORTANT: For history backfill we always write the day,
      // even when steps === 0 so we can distinguish "no data" vs "0 steps".
      await FitnessHistory.findOneAndUpdate(
        { userId: user.googleId, date: bucketDate },
        {
          $set: {
            steps: steps || 0,
            // We don't backfill weight here; points depend only on steps
            weight: undefined,
            source: 'google-fit',
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
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

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    console.log(`📡 Syncing Fitbit history for ${user.email} from ${startDateStr} to ${endDateStr}`);

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
      const entryDate = normalizeDate(new Date(entryDateStr));
      const steps = entry.value ? parseInt(entry.value, 10) : 0;
      const weight = weightMap.get(entryDateStr) || null;

      // Always write the entry, even when steps === 0 and weight === null.
      await FitnessHistory.findOneAndUpdate(
        { userId: user.googleId, date: entryDate },
        {
          $set: {
            steps: steps || 0,
            weight: weight || null,
            source: 'fitbit',
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
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

  const history = await FitnessHistory.find({
    userId: participant.userId,
    date: {
      $gte: normalizeDate(challengeStart),
      $lte: effectiveEnd
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
  const newStepPoints = newStepGoalDays;
  const newTotalPoints = newStepPoints + oldWeightLossPoints;

  participant.stepGoalPoints = newStepPoints;
  participant.stepGoalDaysAchieved = newStepGoalDays;
  participant.points = newTotalPoints;
  participant.lastStepDate = lastStepDate;

  await participant.save();

  console.log(`✅ Recalculated step points for user ${participant.userId} in challenge ${challenge.name}:`, {
    oldStepPoints,
    newStepPoints,
    weightLossPoints: oldWeightLossPoints,
    totalPoints: newTotalPoints
  });
}

async function backfillStepHistoryAndPoints() {
  console.log('🔧 Starting backfill of step history and points for challenge users...');

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
  const now = new Date();
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

