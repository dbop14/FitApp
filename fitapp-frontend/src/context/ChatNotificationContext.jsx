import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserContext } from './UserContext';
import { ChallengeContext } from './ChallengeContext';
import { chatService } from '../utils/chatService';

/**
 * ChatNotificationContext - Manages chat notifications across the app
 * 
 * Features:
 * - Real-time notification checking
 * - Background sync when app is active
 * - Notification preferences
 * - Sound notifications
 * - Badge counts
 */

const ChatNotificationContext = createContext();

export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    throw new Error('useChatNotifications must be used within a ChatNotificationProvider');
  }
  return context;
};

export const ChatNotificationProvider = ({ children }) => {
  const { user } = useContext(UserContext);
  const { challenge: selectedChallenge } = useContext(ChallengeContext);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const notifiedMessageIdsRef = useRef(new Set()); // Track which messages we've already notified about
  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    checkInterval: 10000, // 10 seconds
    showUnreadBadge: true
  });

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fitapp_chat_preferences');
      if (saved) {
        setPreferences(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (error) {
      console.warn('Failed to load chat preferences:', error);
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('fitapp_chat_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save chat preferences:', error);
    }
  }, [preferences]);

  // Get custom notification message based on message type
  const getNotificationMessage = useCallback((message) => {
    if (!message) {
      return 'You have a new message in the chat';
    }

    // Check if it's a bot message
    if (message.isBot) {
      // Check if it's a bot message with a specific type (card messages)
      if (message.messageType) {
        const cardData = message.cardData || {};
        const userName = cardData.userName || 'Someone';
        const challengeName = cardData.challengeName || 'the challenge';
        
        switch (message.messageType) {
          case 'stepGoalCard':
            return `${userName} earned a step point!`;
          case 'dailyStepUpdateCard':
            return 'Check everyone\'s step progress!';
          case 'weighInReminderCard':
            return 'Remember to weigh in!';
          case 'weightLossCard':
            return `${userName} lost weight!`;
          case 'welcomeCard':
            return `${userName} Joined ${challengeName}`;
          case 'startReminderCard':
            return 'Challenge starting soon!';
          case 'winnerCard':
            return 'Challenge winner announced!';
          case 'leaveCard':
            return 'A member left the challenge';
          default:
            // For bot messages with unknown type, use generic prompt
            return 'You have a new message in the chat';
        }
      }
      
      // For plain text bot messages (no messageType), detect by content
      const messageText = (message.message || '').toLowerCase();
      
      // Detect weigh-in reminder messages
      if (messageText.includes('weigh-in day') || 
          messageText.includes('weigh in day') ||
          messageText.includes('log your current weight')) {
        return 'Remember to weigh in!';
      }
      
      // Detect daily step update messages
      if (messageText.includes('step goal progress') || 
          messageText.includes('everyone\'s step') ||
          messageText.includes('everyones step')) {
        return 'Check everyone\'s step progress!';
      }
      
      // For all other bot messages, use generic prompt (don't show message text)
      return 'You have a new message in the chat';
    }

    // For regular user messages, return the full message text
    if (message.sender && message.message) {
      // Skip notifications for "left" messages - these are system messages users don't need to be notified about
      if (message.message.toLowerCase().includes('has left') || 
          message.message.toLowerCase().includes('left the')) {
        return null; // Return null to skip notification
      }
      
      // Return the full message text for user messages
      return message.message;
    }

    // Fallback
    return 'You have a new message in the chat';
  }, []);

  // Show desktop notification
  // For iOS PWA, we must use service worker to show notifications
  const showDesktopNotification = useCallback(async (notification) => {
    if (!('Notification' in window)) {
      console.warn('⚠️ Notifications not supported in this browser');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('⚠️ Notification permission not granted. Current permission:', Notification.permission);
      return;
    }

    try {
      // Detect iOS to use different notification structure
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      
      // For iOS: Put message in title to avoid "From FitApp" text
      // For Android/Desktop: Use title + body structure
      
      // Generate unique tag for each notification to prevent Android from collapsing them
      // Android replaces notifications with the same tag, so we need unique tags for separate notifications
      const uniqueTag = `chat_notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const notificationOptions = {
        body: isIOS ? '' : notification.message, // Empty body on iOS
        icon: '/icon-192x192.png', // Better icon for PWA
        badge: '/badge-icon-48x48.png?v=1', // Badge icon for Android status bar (v=1 for cache busting)
        tag: uniqueTag, // Unique tag for each notification - prevents Android from collapsing them
        requireInteraction: false,
        vibrate: [200, 100, 200], // Vibration pattern for mobile
        data: {
          url: '/chat', // URL to open when notification is clicked
          challengeId: notification.challengeId
        }
      };

      // Use message as title on iOS to avoid "From FitApp" prefix
      const notificationTitle = isIOS ? notification.message : notification.title;

      // Check if service worker is available (required for iOS PWA)
      if ('serviceWorker' in navigator) {
        // Try to get the active service worker
        let swController = navigator.serviceWorker.controller;
        
        // If no controller, wait for it or get registration
        if (!swController) {
          const registration = await navigator.serviceWorker.ready;
          swController = registration.active || navigator.serviceWorker.controller;
        }

        if (swController) {
          // Send message to service worker to show notification
          // This is required for iOS PWA notifications
          swController.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: notificationTitle,
            options: notificationOptions
          });
        } else {
          console.warn('⚠️ Service worker controller not available, using fallback');
          // Fallback for desktop browsers without service worker
          const notif = new Notification(notification.title, notificationOptions);
          
          // Handle notification click - open chat page
          notif.onclick = (event) => {
            event.preventDefault();
            window.focus();
            window.location.href = '/chat';
            notif.close();
          };
        }
      } else {
        console.log('📤 Using direct Notification API (no service worker)');
        // Fallback for desktop browsers without service worker
        const notif = new Notification(notification.title, notificationOptions);
        
        // Handle notification click - open chat page
        notif.onclick = (event) => {
          event.preventDefault();
          window.focus();
          window.location.href = '/chat';
          notif.close();
        };
      }
    } catch (error) {
      console.error('❌ Failed to show desktop notification:', error);
    }
  }, []);


  // Check for new messages
  const checkForNewMessages = useCallback(async (challengeId) => {
    if (!challengeId || isChecking || !user?.sub) {
      return;
    }

    try {
      setIsChecking(true);
      const result = await chatService.checkForNewMessages(challengeId);
      
      
      if (result?.hasNew) {
        const latestMessage = result.latestMessage;
        
        // Skip notification if this is the user's own message
        if (latestMessage.userId === user.sub || 
            latestMessage.sender === user.name || 
            latestMessage.sender === user.email) {
          console.log('⏭️  Skipping notification for own message');
          setLastCheck(new Date());
          return;
        }
        
        // Create a unique message ID to prevent duplicate notifications
        // Use a combination of timestamp, sender, and message content for uniqueness
        const messageId = latestMessage.id || 
          `${latestMessage.timestamp}-${latestMessage.sender || 'unknown'}-${latestMessage.message?.substring(0, 30) || 'no-message'}-${latestMessage.userId || 'no-user'}`;
        
        // Skip if we've already notified about this message
        if (notifiedMessageIdsRef.current.has(messageId)) {
          console.log('⏭️  Already notified about this message, skipping');
          setLastCheck(new Date());
          return;
        }
        
        // Add to notified set BEFORE sending notification to prevent race conditions
        notifiedMessageIdsRef.current.add(messageId);
        
        // Keep only last 200 message IDs to prevent memory issues (increased for better tracking)
        if (notifiedMessageIdsRef.current.size > 200) {
          const array = Array.from(notifiedMessageIdsRef.current);
          array.shift(); // Remove oldest
          notifiedMessageIdsRef.current = new Set(array);
        }
        
        console.log(`🔔 New message detected: ${messageId}`);
        
        // Get custom notification message based on message type
        const notificationMessage = getNotificationMessage(latestMessage);
        
        
        // Skip if notification message is null (e.g., for "left" messages)
        if (!notificationMessage) {
          console.log('⏭️  Skipping notification - message type should not trigger notification');
          setLastCheck(new Date());
          return;
        }
        
        // Determine notification title based on message type
        // For bot messages: "FitApp"
        // For user messages: User's full name (first + last)
        const notificationTitle = latestMessage.isBot 
          ? 'FitApp'
          : (latestMessage.sender || 'FitApp');
        
        // Add notification
        const notification = {
          id: `new_message_${Date.now()}`,
          type: 'info',
          title: notificationTitle,
          message: notificationMessage,
          timestamp: new Date(),
          challengeId,
          isRead: false
        };

        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
        setUnreadCount(prev => prev + 1);

        // Show push notification if enabled
        if (preferences.pushNotifications) {
          console.log('📢 Attempting to show notification...');
          showDesktopNotification(notification);
        } else {
          console.log('⚠️ Push notifications are disabled in preferences');
        }
      }

      setLastCheck(new Date());
    } catch (error) {
      console.warn('Failed to check for new messages:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, preferences.pushNotifications, showDesktopNotification, getNotificationMessage, user?.sub]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, isRead: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
    setUnreadCount(0);
  }, []);

  // Clear notification
  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Update preferences
  const updatePreferences = useCallback((newPreferences) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
  }, []);

  // Request notification permission and subscribe to push notifications
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Desktop notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      // Already granted, subscribe to push notifications
      await subscribeToPushNotifications();
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Subscribe to push notifications after permission is granted
        await subscribeToPushNotifications();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(async () => {
    if (!user?.sub) {
      console.warn('Cannot subscribe to push notifications: user not logged in');
      return;
    }

    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service worker not supported');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from backend
      const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
      const vapidResponse = await fetch(`${apiUrl}/api/push/vapid-public-key`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fitapp_jwt_token')}`
        }
      });
      
      if (!vapidResponse.ok) {
        console.error('Failed to get VAPID public key');
        return;
      }
      
      const { publicKey } = await vapidResponse.json();
      
      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      
      // Send subscription to backend
      const subscribeResponse = await fetch(`${apiUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fitapp_jwt_token')}`
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
              auth: arrayBufferToBase64(subscription.getKey('auth'))
            }
          },
          userId: user.sub
        })
      });
      
      if (subscribeResponse.ok) {
        console.log('✅ Successfully subscribed to push notifications');
        
        // iOS-specific: Verify service worker is active and can receive push events
        if ('serviceWorker' in navigator && registration.active) {
          console.log('📱 [iOS DEBUG] Service worker is active:', registration.active.state);
          console.log('📱 [iOS DEBUG] Push subscription endpoint:', subscription.endpoint.substring(0, 50) + '...');
          
          // Check if this is an iOS subscription
          const isIOS = subscription.endpoint.includes('push.apple.com');
          if (isIOS) {
            console.log('📱 [iOS DEBUG] iOS subscription detected - ensure app is installed as PWA');
            console.log('📱 [iOS DEBUG] To install: Safari > Share > Add to Home Screen');
          }
        }
      } else {
        console.error('Failed to register push subscription');
      }
    } catch (error) {
      console.error('❌ Error subscribing to push notifications:', error);
    }
  }, [user?.sub]);

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Helper function to convert array buffer to base64
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Subscribe to push notifications when user logs in
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2a0a55f1-b268-467d-aef8-a0a0284ba327',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatNotificationContext.jsx:509',message:'Checking Notification API availability',data:{hasUser:!!user?.sub,hasNotificationInWindow:'Notification' in window},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (user?.sub && 'Notification' in window && Notification.permission === 'granted') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2a0a55f1-b268-467d-aef8-a0a0284ba327',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatNotificationContext.jsx:510',message:'Notification permission granted - subscribing',data:{permission:Notification.permission},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      subscribeToPushNotifications();
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2a0a55f1-b268-467d-aef8-a0a0284ba327',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatNotificationContext.jsx:510',message:'Skipping notification subscription',data:{hasUser:!!user?.sub,hasNotification:'Notification' in window,permission:'Notification' in window ? Notification.permission : 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }
  }, [user?.sub, subscribeToPushNotifications]);

  // Set up periodic checking when challenge is selected
  useEffect(() => {
    if (!selectedChallenge?._id || !user?.sub) return;

    // Initial check
    checkForNewMessages(selectedChallenge._id);

    // Set up interval
    const interval = setInterval(() => {
      // Double-check user is still logged in before making API call
      if (!user?.sub) {
        return;
      }
      checkForNewMessages(selectedChallenge._id);
    }, preferences.checkInterval);

    // Also check when app becomes visible (important for iOS background behavior)
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedChallenge?._id && user?.sub) {
        console.log('👁️ App became visible, checking for new messages...');
        checkForNewMessages(selectedChallenge._id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedChallenge?._id, preferences.checkInterval, checkForNewMessages, user?.sub]);

  // Auto-clear old notifications (older than 1 hour)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      setNotifications(prev => 
        prev.filter(notif => new Date(notif.timestamp) > oneHourAgo)
      );
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  // Sync offline messages when challenge changes
  useEffect(() => {
    if (selectedChallenge?._id) {
      chatService.syncOfflineMessages(selectedChallenge._id);
    }
  }, [selectedChallenge?._id]);

  const value = {
    notifications,
    unreadCount,
    isChecking,
    lastCheck,
    preferences,
    checkForNewMessages,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    updatePreferences,
    requestNotificationPermission
  };

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  );
};

export default ChatNotificationProvider;

