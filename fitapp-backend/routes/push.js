const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// VAPID keys - MUST be set in environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('⚠️ WARNING: VAPID keys not set! Push notifications will not work.');
  console.error('⚠️ Generate keys by running: node scripts/generate-vapid-keys.js');
  console.error('⚠️ Then set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
} else {
  // Configure web-push with VAPID keys
  webpush.setVapidDetails(
    'mailto:fitapp@herringm.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ VAPID keys configured for push notifications');
}

// GET VAPID public key (needed for frontend subscription)
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST register push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({ error: 'Missing subscription or userId' });
    }

    // Verify user exists
    const user = await User.findOne({ googleId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store or update subscription
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        lastUsed: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Push subscription registered for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error registering push subscription:', error);
    res.status(500).json({ error: 'Failed to register push subscription' });
  }
});

// POST unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint, userId } = req.body;

    if (!endpoint || !userId) {
      return res.status(400).json({ error: 'Missing endpoint or userId' });
    }

    await PushSubscription.findOneAndDelete({ endpoint, userId });
    console.log(`✅ Push subscription removed for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Helper function to send push notification to a user
async function sendPushNotification(userId, title, body, data = {}) {
  // Check if VAPID keys are configured
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }

  try {
    const subscriptions = await PushSubscription.find({ userId });
    
    // #region agent log
    const fs = require('fs');
    const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
    try {
      const subscriptionInfo = subscriptions.map(sub => ({
        endpoint: (sub.endpoint || '').substring(0, 50),
        isFCM: (sub.endpoint || '').includes('fcm.googleapis.com'),
        isAPNS: (sub.endpoint || '').includes('push.apple.com'),
        createdAt: sub.createdAt,
        lastUsed: sub.lastUsed
      }));
      const logEntry = JSON.stringify({location:'routes/push.js:92',message:'Found push subscriptions',data:{userId,count:subscriptions.length,subscriptions:subscriptionInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'android'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
    } catch(e) {}
    // #endregion
    
    if (subscriptions.length === 0) {
      console.log(`⚠️ No push subscriptions found for user ${userId}`);
      // #region agent log
      const fs = require('fs');
      const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
      try {
        const logEntry = JSON.stringify({location:'routes/push.js:97',message:'No subscriptions found',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'android'}) + '\n';
        fs.appendFileSync(logPath, logEntry);
      } catch(e) {}
      // #endregion
      return;
    }
    
    console.log(`📱 Found ${subscriptions.length} subscription(s) for user ${userId}`);
    subscriptions.forEach((sub, idx) => {
      const endpoint = sub.endpoint || 'unknown';
      const deviceType = endpoint.includes('fcm.googleapis.com') ? 'Android' : 
                        endpoint.includes('push.apple.com') ? 'iOS' : 'Unknown';
      console.log(`   ${idx + 1}. ${deviceType} - ${endpoint.substring(0, 60)}...`);
    });

    // Standard web push payload format
    // iOS requires specific payload structure for APNS
    // Note: requireInteraction, silent, vibrate are set in the service worker, not the payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-icon-48x48.png?v=1', // v=1 for cache busting
      data: {
        url: '/chat',
        ...data
      },
      // iOS-specific: Add timestamp for better delivery
      timestamp: Date.now()
    });

    const promises = subscriptions.map(async (subscription) => {
      try {
        // #region agent log
        const fs = require('fs');
        const logPath = '/volume1/docker/fitapp/.cursor/debug.log';
        try {
          const endpointInfo = subscription.endpoint || 'unknown';
          const isFCM = endpointInfo.includes('fcm.googleapis.com') || endpointInfo.includes('android');
          const isAPNS = endpointInfo.includes('push.apple.com') || endpointInfo.includes('ios');
          const logEntry = JSON.stringify({location:'routes/push.js:110',message:'Sending push notification',data:{userId,endpoint:endpointInfo.substring(0,50),isFCM,isAPNS,subscriptionId:subscription._id.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'android'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
        
        // Platform-specific options for better delivery when phone is locked
        const isFCM = subscription.endpoint.includes('fcm.googleapis.com');
        const isAPNS = subscription.endpoint.includes('push.apple.com');
        
        const options = isFCM ? {
          // Android FCM: High priority for immediate delivery
          TTL: 86400, // 24 hours TTL - how long the notification should be stored if device is offline
          urgency: 'high' // High priority for immediate delivery (Web Push Protocol standard)
        } : isAPNS ? {
          // iOS APNS: TTL for better delivery
          // Note: iOS requires app to be installed as PWA for push notifications to work
          TTL: 86400 // 24 hours TTL
          // urgency is not supported by APNS, but TTL helps
        } : {
          // Other platforms
          TTL: 86400
        };
        
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          payload,
          options
        );
        // Update lastUsed timestamp
        subscription.lastUsed = new Date();
        await subscription.save();
        
        const endpointInfo = subscription.endpoint || 'unknown';
        const deviceType = endpointInfo.includes('fcm.googleapis.com') ? 'Android' : 
                          endpointInfo.includes('push.apple.com') ? 'iOS' : 'Unknown';
        console.log(`✅ Push notification sent to user ${userId} (${deviceType})`);
        
        // #region agent log
        try {
          const logEntry = JSON.stringify({location:'routes/push.js:130',message:'Push notification sent successfully',data:{userId,deviceType,endpoint:endpointInfo.substring(0,50),subscriptionId:subscription._id.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'android'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
      } catch (error) {
        const endpointInfo = subscription.endpoint || 'unknown';
        const deviceType = endpointInfo.includes('fcm.googleapis.com') ? 'Android' : 
                          endpointInfo.includes('push.apple.com') ? 'iOS' : 'Unknown';
        console.error(`❌ Failed to send push to subscription (${deviceType}):`, error.message);
        console.error(`   Endpoint: ${endpointInfo.substring(0, 100)}`);
        console.error(`   Error code: ${error.statusCode || error.code}`);
        console.error(`   Error details:`, error.body || error.message);
        
        // #region agent log
        try {
          const logEntry = JSON.stringify({location:'routes/push.js:140',message:'Push notification failed',data:{userId,deviceType,endpoint:endpointInfo.substring(0,50),error:error.message,statusCode:error.statusCode,code:error.code,errorBody:error.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'android'}) + '\n';
          fs.appendFileSync(logPath, logEntry);
        } catch(e) {}
        // #endregion
        
        // If subscription is invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(subscription._id);
          console.log(`🗑️ Removed invalid subscription for user ${userId} (${deviceType})`);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
  }
}

module.exports = { router, sendPushNotification };

