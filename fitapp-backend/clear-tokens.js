const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function clearUserTokens() {
  try {
    // Clear tokens for the specific user
    const userEmail = 'dbop14@gmail.com';
    
    const result = await User.updateOne(
      { email: userEmail },
      { 
        $unset: { 
          accessToken: 1, 
          refreshToken: 1, 
          tokenExpiry: 1 
        } 
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Cleared tokens for user: ${userEmail}`);
      console.log(`📝 User needs to re-authenticate at: https://fitappbackend.herringm.com/api/auth/google`);
    } else {
      console.log(`❌ User not found: ${userEmail}`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
  } finally {
    mongoose.connection.close();
  }
}

clearUserTokens(); 