const mongoose = require('mongoose');
const ChallengeParticipant = require('../models/ChallengeParticipant');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Comprehensive script to audit all users' points for the double-counting bug
async function auditAllPoints() {
  try {
    console.log('Auditing all users\' points for potential double-counting issues...');
    
    // Get all challenge participants
    const allParticipants = await ChallengeParticipant.find({});
    
    if (allParticipants.length === 0) {
      console.log('No challenge participants found');
      return;
    }
    
    console.log(`Found ${allParticipants.length} total challenge participants`);
    
    let issuesFound = 0;
    let totalDiscrepancy = 0;
    
    for (const participant of allParticipants) {
      // Calculate what the points should be
      let expectedWeightLossPoints = 0;
      if (participant.startingWeight && participant.lastWeight) {
        const percentLost = ((participant.startingWeight - participant.lastWeight) / participant.startingWeight) * 100;
        expectedWeightLossPoints = Math.floor(percentLost);
      }
      
      const expectedTotal = expectedWeightLossPoints + (participant.stepGoalPoints || 0);
      const discrepancy = participant.points - expectedTotal;
      
      // Check for suspicious values
      const hasHighWeightLossPoints = (participant.weightLossPoints || 0) > 100;
      const hasHighTotalPoints = participant.points > 200;
      const hasDiscrepancy = Math.abs(discrepancy) > 5; // Allow small rounding differences
      
      if (hasHighWeightLossPoints || hasHighTotalPoints || hasDiscrepancy) {
        issuesFound++;
        totalDiscrepancy += discrepancy;
        
        // Get user and challenge info
        const user = await User.findOne({ googleId: participant.userId });
        const challenge = await Challenge.findById(participant.challengeId);
        
        console.log('\n' + '='.repeat(80));
        console.log(`ISSUE #${issuesFound} DETECTED`);
        console.log('User:', {
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          googleId: participant.userId
        });
        console.log('Challenge:', {
          name: challenge?.name || 'Unknown',
          challengeId: participant.challengeId
        });
        console.log('Current Points:', {
          totalPoints: participant.points,
          stepGoalPoints: participant.stepGoalPoints || 0,
          weightLossPoints: participant.weightLossPoints || 0,
          stepGoalDaysAchieved: participant.stepGoalDaysAchieved || 0
        });
        console.log('Analysis:', {
          startingWeight: participant.startingWeight,
          lastWeight: participant.lastWeight,
          weightLost: participant.startingWeight && participant.lastWeight ? participant.startingWeight - participant.lastWeight : 'N/A',
          percentLost: participant.startingWeight && participant.lastWeight ? ((participant.startingWeight - participant.lastWeight) / participant.startingWeight * 100).toFixed(2) + '%' : 'N/A',
          expectedWeightLossPoints,
          expectedStepGoalPoints: participant.stepGoalPoints || 0,
          expectedTotal,
          actualTotal: participant.points,
          discrepancy,
          flags: {
            highWeightLossPoints: hasHighWeightLossPoints,
            highTotalPoints: hasHighTotalPoints,
            hasDiscrepancy: hasDiscrepancy
          }
        });
        
        if (discrepancy > 0) {
          console.log(`POINTS ISSUE: Expected ${expectedTotal}, Actual ${participant.points}, Difference: +${discrepancy}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT SUMMARY');
    console.log(`Total participants checked: ${allParticipants.length}`);
    console.log(`Issues found: ${issuesFound}`);
    console.log(`Total point discrepancy: ${totalDiscrepancy}`);
    
    if (issuesFound === 0) {
      console.log('No point calculation issues found!');
    } else {
      console.log('Issues found that may need manual correction');
      console.log('Consider running fixDbop14Points.js for individual users or create a bulk fix script');
    }
    
  } catch (error) {
    console.error('Error auditing points:', error);
  }
}

// Connect to MongoDB and run the script
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('Connected to MongoDB');
    
    await auditAllPoints();
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = auditAllPoints; 