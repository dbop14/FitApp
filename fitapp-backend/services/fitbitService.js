const { ensureValidFitbitTokens } = require('../utils/fitbitAuth');
const FitnessHistory = require('../models/FitnessHistory');

/**
 * Fetch steps data from Fitbit API for a specific date
 * Note: For multiple days, use time series endpoint instead (best practice)
 * @param {string} accessToken - Fitbit access token
 * @param {string} userId - Fitbit user ID (use '-' for current user)
 * @param {Date} date - Date to fetch data for
 * @returns {Promise<number>} - Steps count for the date
 */
async function fetchFitbitSteps(accessToken, userId, date) {
  const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  try {
    // Use time series endpoint for single day (more efficient than daily summary)
    // For multiple days, use date range format: /date/YYYY-MM-DD/YYYY-MM-DD.json
    const response = await fetch(
      `https://api.fitbit.com/1/user/${userId}/activities/steps/date/${dateStr}/1d.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Fitbit access token expired or invalid');
      }
      // Handle rate limiting (429) gracefully
      if (response.status === 429) {
        const errorText = await response.text();
        throw new Error(`Fitbit API rate limited (429): ${errorText}`);
      }
      const errorText = await response.text();
      throw new Error(`Fitbit API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Fitbit returns an array of activities-steps objects
    // For single day, there should be one entry with the total steps
    let totalSteps = 0;
    if (data['activities-steps'] && data['activities-steps'].length > 0) {
      totalSteps = data['activities-steps'][0].value ? parseInt(data['activities-steps'][0].value, 10) : 0;
    }
    
    return totalSteps;
  } catch (error) {
    console.error('❌ Error fetching Fitbit steps:', error);
    throw error;
  }
}

/**
 * Fetch weight data from Fitbit API for a specific date
 * @param {string} accessToken - Fitbit access token
 * @param {string} userId - Fitbit user ID (use '-' for current user)
 * @param {Date} date - Date to fetch data for
 * @returns {Promise<number|null>} - Weight in lbs, or null if not available
 */
async function fetchFitbitWeight(accessToken, userId, date) {
  const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  try {
    const response = await fetch(
      `https://api.fitbit.com/1/user/${userId}/body/log/weight/date/${dateStr}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Fitbit access token expired or invalid');
      }
      // 404 is acceptable for weight - user may not have logged weight that day
      if (response.status === 404) {
        return null;
      }
      // Handle rate limiting (429) gracefully
      if (response.status === 429) {
        const errorText = await response.text();
        throw new Error(`Fitbit API rate limited (429): ${errorText}`);
      }
      const errorText = await response.text();
      throw new Error(`Fitbit API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Fitbit returns weight in the format: { weight: [{ value: 70.5, date: "2024-01-01", ... }] }
    // Get the most recent weight entry for the date (API can return multiple entries per day)
    if (data.weight && data.weight.length > 0) {
      const entriesForDate = data.weight.filter(w => w.date === dateStr);
      if (entriesForDate.length > 0) {
        // Sort by time descending so latest entry of the day wins
        const sorted = [...entriesForDate].sort((a, b) => (b.time || '00:00:00').localeCompare(a.time || '00:00:00'));
        const weightEntry = sorted[0];
        const rawValue = weightEntry?.weight ?? weightEntry?.value;
        if (weightEntry && (rawValue !== undefined && rawValue !== null)) {
          const weightValue = parseFloat(rawValue);
          if (weightEntry.unit === 'kg' || weightEntry.unit === 'en_GB') {
            return Math.round(weightValue * 2.20462 * 100) / 100;
          }
          return weightValue;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error fetching Fitbit weight:', error);
    // Return null instead of throwing for weight - it's optional data
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch steps and weight from Fitbit API for today's data
 * Best practice: For historical data (multiple days), use syncFitbitHistory() 
 * which uses time series endpoints to reduce API calls
 * 
 * @param {Object} user - User document from MongoDB
 * @param {Date} startDate - Start date (unused, kept for API compatibility)
 * @param {Date} endDate - End date (unused, kept for API compatibility)
 * @returns {Promise<Object>} - { steps: number, weight: number|null }
 */
async function fetchFitbitData(user, startDate, endDate) {
  try {
    // Ensure tokens are valid
    const { accessToken } = await ensureValidFitbitTokens(user);
    const fitbitUserId = user.fitbitUserId || '-'; // Use '-' for current user if not set
    
    // For today's data, fetch current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch today's steps
    let steps = 0;
    let weight = null;
    let stepsFetchFailed = false;
    let stepsError = null;
    
    try {
      steps = await fetchFitbitSteps(accessToken, fitbitUserId, today);
    } catch (error) {
      console.error('❌ Error fetching Fitbit steps:', error);
      stepsFetchFailed = true;
      stepsError = error;
      // Continue with weight fetch even if steps fail
    }
    
    // Fetch most recent weight from the last 7 days
    // Fitbit weight endpoint can return data for a date range
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    try {
      // Try to get weight for today first
      weight = await fetchFitbitWeight(accessToken, fitbitUserId, today);
      
      // If no weight for today, try to get the most recent weight from the range
      if (weight === null) {
        const weightResponse = await fetch(
          `https://api.fitbit.com/1/user/${fitbitUserId}/body/log/weight/date/${startDateStr}/${endDateStr}.json`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (weightResponse.ok) {
          const weightData = await weightResponse.json();
          if (weightData.weight && weightData.weight.length > 0) {
            // Fitbit API order is unspecified; sort by date+time descending and take the most recent
            const sorted = [...weightData.weight].sort((a, b) => {
              const dateA = a.date || '';
              const timeA = a.time || '00:00:00';
              const dateB = b.date || '';
              const timeB = b.time || '00:00:00';
              const tsA = `${dateA}T${timeA}`;
              const tsB = `${dateB}T${timeB}`;
              return tsB.localeCompare(tsA);
            });
            const mostRecent = sorted[0];
            const rawValue = mostRecent?.weight ?? mostRecent?.value;
            if (mostRecent && (rawValue !== undefined && rawValue !== null)) {
              const weightValue = parseFloat(rawValue);
              if (mostRecent.unit === 'kg' || mostRecent.unit === 'en_GB') {
                weight = Math.round(weightValue * 2.20462 * 100) / 100;
              } else {
                weight = weightValue;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching Fitbit weight:', error);
      // Weight is optional, so we don't throw
    }
    
    const result = { steps, weight, stepsFetchFailed, stepsError: stepsError?.message || null };
    return result;
  } catch (error) {
    console.error('❌ Error in fetchFitbitData:', error);
    throw error;
  }
}

/**
 * Fetch historical Fitbit data and store in FitnessHistory
 * Uses time series endpoints to reduce API calls (best practice)
 * @param {Object} user - User document from MongoDB
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
async function syncFitbitHistory(user, startDate, endDate) {
  try {
    const { accessToken } = await ensureValidFitbitTokens(user);
    const fitbitUserId = user.fitbitUserId || '-';
    
    // Format dates for API (YYYY-MM-DD)
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Use time series endpoints to reduce API calls (best practice)
    // This reduces from 30+ calls (one per day) to 2 calls (one for steps, one for weight)
    const [stepsResponse, weightResponse] = await Promise.all([
      // Time series endpoint for steps (can return up to 30 days in one call)
      fetch(
        `https://api.fitbit.com/1/user/${fitbitUserId}/activities/steps/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      ),
      // Time series endpoint for weight (can return up to 30 days in one call)
      fetch(
        `https://api.fitbit.com/1/user/${fitbitUserId}/body/log/weight/date/${startDateStr}/${endDateStr}.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
    ]);
    
    // Parse steps data
    let stepsData = null;
    if (stepsResponse.ok) {
      stepsData = await stepsResponse.json();
    } else if (stepsResponse.status !== 404) {
      console.warn(`⚠️ Failed to fetch Fitbit steps history: ${stepsResponse.status}`);
    }
    
    // Parse weight data
    let weightData = null;
    if (weightResponse.ok) {
      weightData = await weightResponse.json();
    } else if (weightResponse.status !== 404) {
      console.warn(`⚠️ Failed to fetch Fitbit weight history: ${weightResponse.status}`);
    }
    
    // Create a map of dates to weight values for efficient lookup
    const weightMap = new Map();
    if (weightData && weightData.weight && Array.isArray(weightData.weight)) {
      weightData.weight.forEach(entry => {
        const rawVal = entry?.weight ?? entry?.value;
        if (entry.date && rawVal !== undefined && rawVal !== null) {
          const weightValue = parseFloat(rawVal);
          let weightInLbs = weightValue;
          // Convert kg to lbs if needed
          if (entry.unit === 'kg' || entry.unit === 'en_GB') {
            weightInLbs = Math.round(weightValue * 2.20462 * 100) / 100;
          }
          weightMap.set(entry.date, weightInLbs);
        }
      });
    }
    
    // Store each day's data from steps time series
    if (stepsData && stepsData['activities-steps']) {
      // Batch database operations for better performance
      const bulkOps = [];
      
      for (const entry of stepsData['activities-steps']) {
        // Parse as local midnight to prevent UTC shift
        // Appending T00:00:00 to YYYY-MM-DD ensures it is parsed as local time
        const entryDate = FitnessHistory.normalizeDate(new Date(entry.dateTime + 'T00:00:00'));
        const steps = entry.value ? parseInt(entry.value, 10) : 0;
        const dateStr = entry.dateTime.split('T')[0]; // Get date string for weight lookup
        const weight = weightMap.get(dateStr) || null;
        
        // Only store if we have steps or weight data
        if (steps > 0 || weight !== null) {
          bulkOps.push({
            updateOne: {
              filter: { userId: user.googleId, date: entryDate },
              update: {
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
              upsert: true
            }
          });
        }
      }
      
      // Execute bulk operations if we have any
      if (bulkOps.length > 0) {
        await FitnessHistory.bulkWrite(bulkOps);
        console.log(`✅ Synced ${bulkOps.length} days of Fitbit history data`);
      }
    }
  } catch (error) {
    console.error('❌ Error syncing Fitbit history:', error);
    throw error;
  }
}

module.exports = {
  fetchFitbitSteps,
  fetchFitbitWeight,
  fetchFitbitData,
  syncFitbitHistory
};
