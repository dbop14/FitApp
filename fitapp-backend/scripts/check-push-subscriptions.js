/**
 * Script to check push subscription status for a user
 * 
 * Usage:
 *   node check-push-subscriptions.js <userId>
 * 
 * This will show:
 * - All push subscriptions for the user
 * - Device type (Android/iOS) based on endpoint
 * - Subscription status
 * - Last used timestamp
 */

const mongoose = require('mongoose');
// Try to load dotenv, but don't fail if it's not available (when running in Docker)
try {
  if (require.resolve('dotenv')) {
    require('dotenv').config();
  }
} catch (e) {
  // dotenv not available, use environment variables from Docker
}

// Resolve paths relative to script location
const path = require('path');
const scriptDir = __dirname;
const modelsDir = path.join(scriptDir, '..', 'models');

const PushSubscription = require(path.join(modelsDir, 'PushSubscription'));
const User = require(path.join(modelsDir, 'User'));

// MongoDB connection
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoosedb:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
};

// Main function
const checkSubscriptions = async (userId) => {
  try {
    await connectMongo();
    
    if (!userId) {
      console.error('❌ Please provide a userId');
      console.log('Usage: node check-push-subscriptions.js <userId>');
      process.exit(1);
    }
    
    console.log(`\n🔍 Checking push subscriptions for user: ${userId}\n`);
    
    // Find user
    const user = await User.findOne({ googleId: userId });
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }
    
    console.log(`👤 User: ${user.name || user.email} (${user.googleId})\n`);
    
    // Find all subscriptions
    const subscriptions = await PushSubscription.find({ userId });
    
    if (subscriptions.length === 0) {
      console.log('⚠️  No push subscriptions found for this user');
      console.log('\n💡 To subscribe:');
      console.log('   1. Open the app on your device');
      console.log('   2. Go to Account Settings');
      console.log('   3. Enable push notifications');
      process.exit(0);
    }
    
    console.log(`📱 Found ${subscriptions.length} subscription(s):\n`);
    
    subscriptions.forEach((sub, idx) => {
      const endpoint = sub.endpoint || 'unknown';
      const isFCM = endpoint.includes('fcm.googleapis.com');
      const isAPNS = endpoint.includes('push.apple.com');
      const deviceType = isFCM ? 'Android (FCM)' : 
                        isAPNS ? 'iOS (APNS)' : 
                        'Unknown';
      
      console.log(`${idx + 1}. ${deviceType}`);
      console.log(`   Endpoint: ${endpoint.substring(0, 80)}...`);
      console.log(`   Created: ${sub.createdAt || 'unknown'}`);
      console.log(`   Last Used: ${sub.lastUsed || 'never'}`);
      console.log(`   Subscription ID: ${sub._id}`);
      console.log('');
    });
    
    // Summary
    const androidCount = subscriptions.filter(s => s.endpoint?.includes('fcm.googleapis.com')).length;
    const iosCount = subscriptions.filter(s => s.endpoint?.includes('push.apple.com')).length;
    const unknownCount = subscriptions.length - androidCount - iosCount;
    
    console.log('📊 Summary:');
    console.log(`   Android: ${androidCount}`);
    console.log(`   iOS: ${iosCount}`);
    console.log(`   Unknown: ${unknownCount}`);
    console.log('');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed');
  }
};

// Get userId from command line
const userId = process.argv[2];

checkSubscriptions(userId).then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

