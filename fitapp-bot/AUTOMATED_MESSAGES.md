# Automated Messages Sent by Fitness Bot

The bot sends the following automated messages:

## 1. Step Point Change Messages
- **Trigger**: Every 30 seconds (interval)
- **Function**: `checkStepPointChanges()`
- **Condition**: When a participant's `stepGoalPoints` increases
- **Message Type**: Card message (`stepGoalCard`)
- **Logs**: `🔔 Step point increase detected`, `📤 Calling sendCardMessage`

## 2. New Participant Welcome Messages
- **Trigger**: Every 2 minutes (interval) + on startup
- **Function**: `checkNewParticipants()`
- **Condition**: New participant joined within last hour OR challenge started within last 7 days
- **Message Type**: Card message (`welcomeCard`)
- **Logs**: `👋 Welcoming new participant`, `✅ Successfully sent welcome card`

## 3. Daily Step Updates
- **Trigger**: Cron jobs at 12:00 PM (noon) and 9:00 PM (21:00)
- **Function**: `sendDailyStepUpdate()`
- **Condition**: Active challenges with participants
- **Message Type**: Plain text message
- **Logs**: `📊 Running daily step update`, `📤 Sending daily step update`

## 4. Weigh-In Reminders
- **Trigger**: Cron job at 8:00 AM daily
- **Function**: `sendWeighInReminder()`
- **Condition**: Today is the challenge's `weighInDay` AND challenge is active
- **Message Type**: Card message (`weighInReminderCard`)
- **Logs**: `⚖️ Checking for weigh-in reminders`, `⚖️ Sending weigh-in reminder`

## 5. Weight Loss Celebrations
- **Trigger**: Cron job at 9:00 AM daily
- **Function**: `checkWeightLossCelebrations()`
- **Condition**: Yesterday was weigh-in day AND participant lost weight
- **Message Type**: Card message (`weightLossCard`)
- **Logs**: `🎉 Checking for weight loss celebrations`, `🎉 Weight loss detected!`

## 6. Challenge Winner Announcements
- **Trigger**: Cron job at 10:00 AM daily
- **Function**: `announceChallengeWinner()`
- **Condition**: Challenge has ended (endDate <= today) AND winner not yet announced
- **Message Type**: Card message (`winnerCard`)
- **Logs**: `🏆 Checking for challenge winners`, `📤 Sending winner announcement`

## 7. Challenge Start Reminders
- **Trigger**: Cron job at 8:00 AM daily
- **Function**: `sendChallengeStartReminders()`
- **Condition**: Challenge starts tomorrow (startDate = tomorrow)
- **Message Type**: Plain text message
- **Logs**: `📅 Checking for challenge start reminders`, `📤 Sending challenge start reminder`

## Common Conditions for All Messages

All messages check:
- ✅ `mongoConnected` - MongoDB must be connected
- ✅ `matrixConnected` - Matrix must be connected
- ✅ `challenge.matrixRoomId` - Challenge must have a Matrix room
- ✅ `!announcedWinners.has(challengeKey)` - Winner not already announced (prevents all messages after winner)

## Debugging

All functions now have comprehensive logging:
- Entry/exit logs
- Condition checks
- Participant/challenge counts
- Success/failure messages
- Error details with stack traces

Check bot logs with: `docker-compose logs fitness-bot --tail 100`

