const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  challengeId: {
    type: String,
    required: true,
    index: true
  },
  sender: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isBot: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  isOwn: {
    type: Boolean,
    default: false
  },
  userId: {
    type: String,
    required: false,
    index: true
  },
  userPicture: {
    type: String,
    required: false
  },
  messageType: {
    type: String,
    enum: ['text', 'stepGoalCard', 'dailyStepUpdateCard', 'weighInReminderCard', 'weightLossCard', 'welcomeCard', 'startReminderCard', 'winnerCard', 'leaveCard'],
    default: 'text'
  },
  imageUrl: {
    type: String,
    required: false
  },
  cardData: {
    type: mongoose.Schema.Types.Mixed, // For flexible card data
    required: false
  }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);

