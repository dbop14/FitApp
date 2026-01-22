import { API_BASE_URL } from './constants';

/**
 * Chat Service - Handles chat operations with local storage caching
 * 
 * Features:
 * - Local storage caching for messages
 * - Optimistic updates
 * - Batch API calls
 * - Offline support
 * - Message deduplication
 */

class ChatService {
  constructor() {
    this.cacheKey = 'fitapp_chat_messages';
    this.lastSyncKey = 'fitapp_chat_last_sync';
    this.offlineMessagesKey = 'fitapp_chat_offline_messages';
    this.hasWarnedAboutMissingToken = false;
    this.lastTokenWarningTime = 0;
    this.lastApiErrorWarningTime = 0;
    this.apiErrorWarningCount = 0;
    // Detect iOS PWA for stricter limits
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    this.maxCachedMessages = isIOS ? 100 : 200; // Stricter limit for iOS
    this.maxOfflineMessages = isIOS ? 15 : 30; // Stricter limit for iOS
    this.lastCacheWarningTime = 0;
    this.maxCacheSizeBytes = isIOS ? 0.5 * 1024 * 1024 : 2 * 1024 * 1024; // 500KB for iOS, 2MB for others
  }

  // Get cache key for a specific challenge
  getCacheKey(challengeId) {
    return `${this.cacheKey}_${challengeId}`;
  }

  // Get last sync key for a specific challenge
  getLastSyncKey(challengeId) {
    return `${this.lastSyncKey}_${challengeId}`;
  }

  // Get offline messages key for a specific challenge
  getOfflineMessagesKey(challengeId) {
    return `${this.offlineMessagesKey}_${challengeId}`;
  }

  // Load messages from local storage
  loadFromCache(challengeId) {
    try {
      const cached = localStorage.getItem(this.getCacheKey(challengeId));
      if (cached) {
        const messages = JSON.parse(cached);
        // Convert timestamp strings back to Date objects
        return messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load chat cache:', error);
    }
    return [];
  }

  // Save messages to local storage
  saveToCache(challengeId, messages) {
    if (!challengeId || !messages) {
      return;
    }

    // First, try to prune based on size to prevent quota errors
    let prunedMessages = this.pruneMessagesBySize(messages, this.maxCacheSizeBytes);
    // Then prune by count
    prunedMessages = this.pruneMessages(prunedMessages, this.maxCachedMessages);
    
    try {
      const cacheKey = this.getCacheKey(challengeId);
      const lastSyncKey = this.getLastSyncKey(challengeId);
      const serialized = JSON.stringify(prunedMessages);
      
      // Check if we're about to exceed quota before attempting save
      if (this.wouldExceedQuota(cacheKey, serialized)) {
        // Aggressively clear old caches first
        this.clearOldChatCaches(challengeId);
      }
      
      localStorage.setItem(cacheKey, serialized);
      // Update last sync timestamp
      localStorage.setItem(lastSyncKey, Date.now().toString());
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        // Try more aggressive recovery
        const recovered = this.tryRecoverFromQuota(challengeId, prunedMessages);
        if (!recovered) {
          // Last resort: clear all other chat caches and try again
          this.clearAllOtherChatCaches(challengeId);
          try {
            const finalPruned = this.pruneMessages(prunedMessages, 50); // Very small cache
            localStorage.setItem(this.getCacheKey(challengeId), JSON.stringify(finalPruned));
            localStorage.setItem(this.getLastSyncKey(challengeId), Date.now().toString());
            this.warnCacheOnce('Chat cache saved with reduced size due to storage limits', error);
          } catch (retryError) {
            this.warnCacheOnce('Failed to save chat cache (storage full)', retryError);
            // Don't throw - allow app to continue without cache
          }
        }
        return;
      }
      console.warn('Failed to save chat cache:', error);
    }
  }

  // Get last sync timestamp
  getLastSync(challengeId) {
    try {
      const timestamp = localStorage.getItem(this.getLastSyncKey(challengeId));
      return timestamp ? parseInt(timestamp) : 0;
    } catch (error) {
      return 0;
    }
  }

  // Save offline message
  saveOfflineMessage(challengeId, message) {
    try {
      const key = this.getOfflineMessagesKey(challengeId);
      const offlineMessages = JSON.parse(localStorage.getItem(key) || '[]');
      const cappedMessages = [...offlineMessages, message].slice(-this.maxOfflineMessages);
      localStorage.setItem(key, JSON.stringify(cappedMessages));
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        const recovered = this.tryRecoverFromQuota(challengeId, [message], true);
        if (!recovered) {
          this.warnCacheOnce('Failed to save offline message (storage full)', error);
        }
        return;
      }
      console.warn('Failed to save offline message:', error);
    }
  }

  // Get offline messages
  getOfflineMessages(challengeId) {
    try {
      const key = this.getOfflineMessagesKey(challengeId);
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
      return [];
    }
  }

  // Clear offline messages
  clearOfflineMessages(challengeId) {
    try {
      localStorage.removeItem(this.getOfflineMessagesKey(challengeId));
    } catch (error) {
      console.warn('Failed to clear offline messages:', error);
    }
  }

  // Fetch messages from API with caching
  async fetchMessages(challengeId, forceRefresh = false) {
    if (!challengeId) {
      console.error('fetchMessages called without challengeId');
      return [];
    }
    
    const lastSync = this.getLastSync(challengeId);
    const now = Date.now();
    const cacheAge = now - lastSync;
    
    // Use cache if it's less than 2 minutes old and not forcing refresh
    // Matches React Query staleTime for consistency
    if (!forceRefresh && cacheAge < 120000) {
      const cachedMessages = this.loadFromCache(challengeId);
      if (cachedMessages.length > 0) {
        return cachedMessages;
      }
    }

    try {
      console.log('Fetching messages from API...');
      
      // Get JWT token for authorization
      const token = localStorage.getItem('fitapp_jwt_token');
      
      const response = await fetch(`${API_BASE_URL}/api/chat/${challengeId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Fetch messages response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fetch messages error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const messages = await response.json();
      console.log('Raw messages from API:', messages);
      
      // Convert timestamps and save to cache
      const processedMessages = messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      // Try to save to cache, but don't fail if it doesn't work
      try {
        this.saveToCache(challengeId, processedMessages);
        console.log('Fetched and cached messages:', processedMessages.length);
      } catch (cacheError) {
        // Log but don't throw - we still have the messages from API
        console.warn('Failed to cache messages, but continuing with API data:', cacheError);
      }
      
      return processedMessages;
    } catch (error) {
      console.warn('Failed to fetch messages, using cache:', error);
      
      // Fallback to cache if available
      const cachedMessages = this.loadFromCache(challengeId);
      if (cachedMessages.length > 0) {
        return cachedMessages;
      }
      
      throw error;
    }
  }

  // Send message with optimistic update
  async sendMessage(challengeId, messageData) {
    // Create optimistic message
    const optimisticMessage = {
      id: `temp_${Date.now()}_${Math.random()}`,
      ...messageData,
      timestamp: new Date(),
      isOptimistic: true
    };

    try {
      // Get JWT token for authorization
      const token = localStorage.getItem('fitapp_jwt_token');
      
      // Send to API
      console.log('Sending message to API:', { challengeId, messageData });
      
      const response = await fetch(`${API_BASE_URL}/api/chat/${challengeId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const savedMessage = await response.json();
      console.log('Message saved successfully:', savedMessage);
      
      // Update cache with real message
      const cachedMessages = this.loadFromCache(challengeId);
      const updatedMessages = cachedMessages.map(msg => 
        msg.id === optimisticMessage.id ? { ...savedMessage, timestamp: new Date(savedMessage.timestamp) } : msg
      );
      
      try {
        this.saveToCache(challengeId, updatedMessages);
        console.log('Updated cache with saved message');
      } catch (cacheError) {
        // Log but don't fail - message was successfully sent to server
        console.warn('Failed to update cache after sending message:', cacheError);
      }
      
      return savedMessage;
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Save to offline queue for later sync
      this.saveOfflineMessage(challengeId, messageData);
      
      throw error;
    }
  }

  // Sync offline messages
  async syncOfflineMessages(challengeId) {
    const offlineMessages = this.getOfflineMessages(challengeId);
    if (offlineMessages.length === 0) return;

    console.log(`Syncing ${offlineMessages.length} offline messages...`);

    try {
      for (const messageData of offlineMessages) {
        await this.sendMessage(challengeId, messageData);
      }
      
      // Clear offline messages after successful sync
      this.clearOfflineMessages(challengeId);
      console.log('Offline messages synced successfully');
    } catch (error) {
      console.error('Failed to sync offline messages:', error);
    }
  }

  // Check for new messages (lightweight check)
  async checkForNewMessages(challengeId) {
    try {
      // First check if user is logged in
      const storedUser = localStorage.getItem('fitapp_user');
      if (!storedUser) {
        // User is not logged in, silently return without logging
        return null;
      }
      
      // Get JWT token for authorization
      const token = localStorage.getItem('fitapp_jwt_token');
      
      // DO NOT LOG TOKEN INFO - This function is called too frequently
      // Any logging here will spam the console
      
      if (!token) {
        // Only warn once per 5 minutes to prevent log spam
        const now = Date.now();
        if (!this.hasWarnedAboutMissingToken || (now - this.lastTokenWarningTime) > 300000) {
          console.warn('No JWT token found for chat API call');
          this.hasWarnedAboutMissingToken = true;
          this.lastTokenWarningTime = now;
        }
        return null;
      }
      
      // Reset warning flag if token is found
      this.hasWarnedAboutMissingToken = false;
      
      // Fetch all messages (backend sorts ascending, we'll get the last one)
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/api/chat/${challengeId}/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
        // Network error (iOS PWA "Load failed" errors are caught here)
        // Silently return null to prevent error spam - this is expected on network issues
        return null;
      }
      
      if (!response.ok) {
        // Throttle API error warnings - only log once per 5 minutes
        const now = Date.now();
        if (!this.lastApiErrorWarningTime || (now - this.lastApiErrorWarningTime) > 300000) {
          console.warn(`Chat API call failed: ${response.status} ${response.statusText}`);
          this.lastApiErrorWarningTime = now;
          this.apiErrorWarningCount = 1;
        } else {
          this.apiErrorWarningCount++;
        }
        return null;
      }
      
      // Reset error warning count on successful call
      if (this.apiErrorWarningCount > 0) {
        this.apiErrorWarningCount = 0;
        this.lastApiErrorWarningTime = 0;
      }

      const messages = await response.json();
      if (messages.length === 0) return null;

      // Backend returns messages sorted ascending, so the last message is the newest
      const latestMessage = messages[messages.length - 1];
      const cachedMessages = this.loadFromCache(challengeId);
      
      // If cache is empty but we have messages from API, treat as new messages
      if (cachedMessages.length === 0) {
        // Update cache with all messages
        try {
          this.saveToCache(challengeId, messages);
        } catch (cacheError) {
          // Log but don't fail - we can still return the new message info
          console.warn('Failed to update cache with messages:', cacheError);
        }
        
        return {
          hasNew: true,
          count: messages.length,
          latestTimestamp: new Date(latestMessage.timestamp),
          latestMessage: latestMessage
        };
      }

      const lastCachedMessage = cachedMessages[cachedMessages.length - 1];
      
      // Check if we have new messages by comparing timestamps
      const latestTimestamp = new Date(latestMessage.timestamp).getTime();
      const cachedTimestamp = new Date(lastCachedMessage.timestamp).getTime();
      
      if (latestTimestamp > cachedTimestamp) {
        // Immediately update cache with the new message to prevent duplicate detections
        // This prevents the same message from being detected as "new" on subsequent checks
        const updatedCache = [...cachedMessages, latestMessage];
        try {
          this.saveToCache(challengeId, updatedCache);
        } catch (cacheError) {
          // Log but don't fail - we can still return the new message info
          console.warn('Failed to update cache with new message:', cacheError);
        }
        
        return {
          hasNew: true,
          count: 1, // At least one new message
          latestTimestamp: new Date(latestMessage.timestamp),
          latestMessage: latestMessage // Include the latest message for notification customization
        };
      }

      return { hasNew: false };
    } catch (error) {
      // Don't log network errors - they're expected on iOS PWAs
      if (error?.name !== 'TypeError' || !error?.message?.includes('Load failed')) {
        console.warn('Failed to check for new messages:', error);
      }
      return null;
    }
  }

  // Clear cache for a challenge
  clearCache(challengeId) {
    try {
      localStorage.removeItem(this.getCacheKey(challengeId));
      localStorage.removeItem(this.getLastSyncKey(challengeId));
      localStorage.removeItem(this.getOfflineMessagesKey(challengeId));
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats(challengeId) {
    try {
      const messages = this.loadFromCache(challengeId);
      const lastSync = this.getLastSync(challengeId);
      const offlineMessages = this.getOfflineMessages(challengeId);
      
      return {
        cachedMessages: messages.length,
        lastSync: lastSync ? new Date(lastSync) : null,
        offlineMessages: offlineMessages.length,
        cacheSize: JSON.stringify(messages).length,
        isStale: Date.now() - lastSync > 300000 // 5 minutes
      };
    } catch (error) {
      return null;
    }
  }

  pruneMessages(messages, maxCount) {
    if (!Array.isArray(messages)) {
      return [];
    }
    if (messages.length <= maxCount) {
      return messages;
    }
    return messages.slice(messages.length - maxCount);
  }

  // Prune messages based on size (bytes) to prevent quota issues
  pruneMessagesBySize(messages, maxBytes) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return messages;
    }
    
    // Start from the end (most recent messages) and work backwards
    let totalSize = 0;
    const result = [];
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageSize = new Blob([JSON.stringify(message)]).size;
      
      if (totalSize + messageSize > maxBytes && result.length > 0) {
        break;
      }
      
      result.unshift(message);
      totalSize += messageSize;
    }
    
    return result;
  }

  // Check if saving would exceed quota
  wouldExceedQuota(key, value) {
    try {
      // Estimate current localStorage usage
      let currentSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          const item = localStorage.getItem(k);
          if (item) {
            currentSize += new Blob([item]).size;
          }
        }
      }
      
      // Estimate new size
      const existingValue = localStorage.getItem(key);
      const existingSize = existingValue ? new Blob([existingValue]).size : 0;
      const newSize = new Blob([value]).size;
      const estimatedTotal = currentSize - existingSize + newSize;
      
      // iOS PWAs have very strict limits (often 1-2MB), be very conservative
      // Use 1MB threshold for iOS, 4MB for others
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const threshold = isIOS ? 0.8 * 1024 * 1024 : 4 * 1024 * 1024; // 800KB for iOS, 4MB for others
      return estimatedTotal > threshold;
    } catch {
      return false; // If we can't check, proceed anyway
    }
  }

  isQuotaExceededError(error) {
    return error?.name === 'QuotaExceededError' || error?.code === 22;
  }

  warnCacheOnce(message, error) {
    const now = Date.now();
    if (!this.lastCacheWarningTime || now - this.lastCacheWarningTime > 300000) {
      console.warn(message, error);
      this.lastCacheWarningTime = now;
    }
  }

  tryRecoverFromQuota(challengeId, messages, isOffline = false) {
    try {
      // Attempt to free space by clearing other chat caches
      this.clearOtherChatCaches(challengeId);
    } catch {
      // Ignore cleanup failures
    }

    const cacheKey = isOffline
      ? this.getOfflineMessagesKey(challengeId)
      : this.getCacheKey(challengeId);
    const lastSyncKey = this.getLastSyncKey(challengeId);
    const fallbackLimits = isOffline ? [10, 5, 1] : [200, 100, 50];

    for (const limit of fallbackLimits) {
      try {
        const trimmed = this.pruneMessages(messages, limit);
        localStorage.setItem(cacheKey, JSON.stringify(trimmed));
        if (!isOffline) {
          localStorage.setItem(lastSyncKey, Date.now().toString());
        }
        return true;
      } catch (error) {
        if (!this.isQuotaExceededError(error)) {
          console.warn('Failed to save chat cache:', error);
          return false;
        }
      }
    }

    // Last resort: drop this cache entry to avoid repeated failures
    try {
      localStorage.removeItem(cacheKey);
      if (!isOffline) {
        localStorage.removeItem(lastSyncKey);
      }
    } catch {
      // Ignore cleanup failures
    }
    return false;
  }

  clearOtherChatCaches(currentChallengeId) {
    const currentCacheKey = this.getCacheKey(currentChallengeId);
    const currentLastSyncKey = this.getLastSyncKey(currentChallengeId);
    const currentOfflineKey = this.getOfflineMessagesKey(currentChallengeId);
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isChatKey =
        key.startsWith(this.cacheKey) ||
        key.startsWith(this.lastSyncKey) ||
        key.startsWith(this.offlineMessagesKey);

      if (isChatKey && key !== currentCacheKey && key !== currentLastSyncKey && key !== currentOfflineKey) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  // Clear old chat caches based on last sync time (keep only recent ones)
  clearOldChatCaches(currentChallengeId) {
    try {
      const currentCacheKey = this.getCacheKey(currentChallengeId);
      const currentLastSyncKey = this.getLastSyncKey(currentChallengeId);
      const currentOfflineKey = this.getOfflineMessagesKey(currentChallengeId);
      
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const keysToRemove = [];
      const challengeSyncTimes = [];

      // First pass: collect all challenge sync times
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith(this.lastSyncKey) && key !== currentLastSyncKey) {
          try {
            const timestamp = parseInt(localStorage.getItem(key) || '0');
            if (timestamp > 0) {
              const challengeId = key.replace(`${this.lastSyncKey}_`, '');
              challengeSyncTimes.push({ challengeId, timestamp, key });
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Sort by timestamp (oldest first)
      challengeSyncTimes.sort((a, b) => a.timestamp - b.timestamp);

      // Remove old caches - keep only 1-2 most recent challenges on iOS (stricter)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const toKeep = isIOS ? 1 : 3;
      const toRemove = challengeSyncTimes.slice(0, Math.max(0, challengeSyncTimes.length - toKeep));
      
      toRemove.forEach(({ challengeId }) => {
        keysToRemove.push(this.getCacheKey(challengeId));
        keysToRemove.push(this.getLastSyncKey(challengeId));
        keysToRemove.push(this.getOfflineMessagesKey(challengeId));
      });

      // Also remove any caches without sync timestamps (orphaned)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith(this.cacheKey) && key !== currentCacheKey) {
          const challengeId = key.replace(`${this.cacheKey}_`, '');
          const hasSyncKey = localStorage.getItem(this.getLastSyncKey(challengeId));
          if (!hasSyncKey) {
            keysToRemove.push(key);
            keysToRemove.push(this.getOfflineMessagesKey(challengeId));
          }
        }
      }

      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore removal errors
        }
      });
    } catch (error) {
      console.warn('Error clearing old chat caches:', error);
    }
  }

  // Clear all other chat caches (more aggressive)
  clearAllOtherChatCaches(currentChallengeId) {
    try {
      const currentCacheKey = this.getCacheKey(currentChallengeId);
      const currentLastSyncKey = this.getLastSyncKey(currentChallengeId);
      const currentOfflineKey = this.getOfflineMessagesKey(currentChallengeId);
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const isChatKey =
          key.startsWith(this.cacheKey) ||
          key.startsWith(this.lastSyncKey) ||
          key.startsWith(this.offlineMessagesKey);

        if (isChatKey && key !== currentCacheKey && key !== currentLastSyncKey && key !== currentOfflineKey) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore removal errors
        }
      });
    } catch (error) {
      console.warn('Error clearing all other chat caches:', error);
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
