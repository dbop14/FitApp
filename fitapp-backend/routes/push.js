const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// VAPID keys - MUST be set in environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

function normalizeSubscription(subscription) {
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  const keys = subscription.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return null;
  }
  return {
    endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth
    }
  };
}

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

    const normalizedSubscription = normalizeSubscription(subscription);
    if (!normalizedSubscription) {
      return res.status(400).json({ error: 'Invalid push subscription format' });
    }

    // Verify user exists
    const user = await User.findOne({ googleId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store or update subscription
    await PushSubscription.findOneAndUpdate(
      { endpoint: normalizedSubscription.endpoint },
      {
        userId,
        endpoint: normalizedSubscription.endpoint,
        keys: normalizedSubscription.keys,
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

// POST send a test push notification for current user
router.post('/test', async (req, res) => {
  const userId = req.body.userId || req.user?.sub;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    await sendPushNotification(
      userId,
      'FitApp Test',
      'This is a test notification',
      { url: '/chat', test: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error sending test push notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
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
    
    if (subscriptions.length === 0) {
      console.log(`⚠️ No push subscriptions found for user ${userId}`);
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
      } catch (error) {
        const endpointInfo = subscription.endpoint || 'unknown';
        const deviceType = endpointInfo.includes('fcm.googleapis.com') ? 'Android' : 
                          endpointInfo.includes('push.apple.com') ? 'iOS' : 'Unknown';
        console.error(`❌ Failed to send push to subscription (${deviceType}):`, error.message);
        console.error(`   Endpoint: ${endpointInfo.substring(0, 100)}`);
        console.error(`   Error code: ${error.statusCode || error.code}`);
        console.error(`   Error details:`, error.body || error.message);
        
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

