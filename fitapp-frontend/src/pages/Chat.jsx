import React, { useContext, useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { ChallengeContext } from '../context/ChallengeContext';
import { useChatNotifications } from '../context/ChatNotificationContext';
import { unifiedDesignSystem } from '../config/unifiedDesignSystem';
import Button from '../components/ui/Button';
import { chatService } from '../utils/chatService';
import MainLayout from '../layout/MainLayout';

const Chat = () => {
  const { user, logout } = useContext(UserContext);
  const { challenge: selectedChallenge, saveChallenge } = useContext(ChallengeContext);
  const { markAllAsRead, unreadCount } = useChatNotifications();
  const navigate = useNavigate();
  
  // State for multiple challenges
  const [userChallenges, setUserChallenges] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fitapp_chat_userChallenges')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  });
  const [completedChallenges, setCompletedChallenges] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fitapp_chat_completedChallenges')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  });
  const hasEverBeenReadyRef = useRef(false) // Track if we've ever been ready (one-way gate)
  const userManuallyClosedChatRef = useRef(false) // Track if user manually closed the chat view
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [showCompletedChallenges, setShowCompletedChallenges] = useState(false);
  const [viewingChat, setViewingChat] = useState(false);
  
  // State for current chat - load from cache immediately if available
  const [messages, setMessages] = useState(() => {
    // Try to load from cache on initial mount if we have an active challenge
    // This will be updated when activeChallenge changes
    return []
  });
  const initializedChallengesRef = useRef(new Set()); // Track which challenges have been initialized
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fetchingChallenges, setFetchingChallenges] = useState(() => {
    // If we have cached challenges, don't show loading
    try {
      const hasCached = sessionStorage.getItem('fitapp_chat_userChallenges') || sessionStorage.getItem('fitapp_chat_completedChallenges')
      return !hasCached
    } catch {
      return true
    }
  });
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Cache challenges when they change
  useEffect(() => {
    if (userChallenges.length > 0 || completedChallenges.length > 0) {
      try {
        sessionStorage.setItem('fitapp_chat_userChallenges', JSON.stringify(userChallenges))
        sessionStorage.setItem('fitapp_chat_completedChallenges', JSON.stringify(completedChallenges))
        hasEverBeenReadyRef.current = true
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [userChallenges, completedChallenges])
  
  // Load cached messages immediately when active challenge changes
  useEffect(() => {
    if (activeChallenge?._id) {
      // Load from cache immediately (synchronously) for instant display
      const cachedMessages = chatService.loadFromCache(activeChallenge._id);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
        setIsConnected(true);
        setLoading(false);
        // Update last seen message count
        lastSeenMessageCountRef.current = cachedMessages.length;
      } else {
        // No cache, show loading state
        setLoading(true);
      }
    } else {
      // No active challenge, clear messages
      setMessages([]);
    }
  }, [activeChallenge?._id]);

  // Cache messages when they change (per challenge) - chatService handles this, but we also update sessionStorage for compatibility
  useEffect(() => {
    if (activeChallenge?._id && messages.length >= 0) {
      try {
        // Update chatService cache (localStorage)
        chatService.saveToCache(activeChallenge._id, messages);
        
        // Also update sessionStorage for backward compatibility
        const cacheKey = `fitapp_chat_messages_${activeChallenge._id}`
        sessionStorage.setItem(cacheKey, JSON.stringify({
          messages,
          timestamp: Date.now()
        }))
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [messages, activeChallenge?._id])
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMessageTimestampRef = useRef(null);
  const inputRef = useRef(null);
  const lastSeenMessageCountRef = useRef(0); // Track last seen message count to detect new messages
  const isAtBottomRef = useRef(true); // Track if user is at bottom of messages

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      // Use scrollIntoView with block: 'end' to ensure it scrolls to the very bottom
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);
  
  // Hide navigation bar when input is focused
  useEffect(() => {
    if (isInputFocused && viewingChat) {
      // Hide navigation bar by adding class to body and html
      document.body.classList.add('chat-input-focused');
      document.documentElement.classList.add('chat-input-focused');
      
      // Also directly target the navigation element as fallback for mobile
      const navElement = document.querySelector('.bottom-navigation');
      if (navElement) {
        navElement.style.transform = 'translateY(100%)';
        navElement.style.pointerEvents = 'none';
      }
      
      // Scroll to bottom when keyboard appears - use longer delay for mobile
      setTimeout(() => {
        scrollToBottom();
        // Also try scrolling the container directly as fallback
        if (messagesContainerRef.current && messagesEndRef.current) {
          const container = messagesContainerRef.current;
          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          container.scrollTop = scrollHeight - clientHeight;
        }
      }, 300);
    } else {
      document.body.classList.remove('chat-input-focused');
      document.documentElement.classList.remove('chat-input-focused');
      
      // Restore navigation element
      const navElement = document.querySelector('.bottom-navigation');
      if (navElement) {
        navElement.style.removeProperty('transform');
        navElement.style.removeProperty('pointer-events');
      }
    }
    
    return () => {
      document.body.classList.remove('chat-input-focused');
      document.documentElement.classList.remove('chat-input-focused');
      const navElement = document.querySelector('.bottom-navigation');
      if (navElement) {
        navElement.style.removeProperty('transform');
        navElement.style.removeProperty('pointer-events');
      }
    };
  }, [isInputFocused, viewingChat, scrollToBottom]);

  // Check if user is at bottom of messages
  const checkIfAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return false;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Consider "at bottom" if within 100px of the bottom (to account for rounding)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    
    // If at bottom, update last seen message count and clear unread notifications
    if (isAtBottom && messages.length > 0) {
      lastSeenMessageCountRef.current = messages.length;
      // Clear unread count when user scrolls to bottom
      if (unreadCount > 0) {
        markAllAsRead();
      }
    }
    
    return isAtBottom;
  }, [messages.length, unreadCount, markAllAsRead]);

  // Track scroll position to detect when user is at bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkIfAtBottom]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
    // Also ensure we can scroll to the very bottom with a small delay
    setTimeout(() => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
        // Check if we're at bottom after scrolling
        checkIfAtBottom();
      }
    }, 100);
  }, [messages, scrollToBottom, checkIfAtBottom]);
  
  // Ensure scroll to bottom when viewing chat
  useEffect(() => {
    if (viewingChat && activeChallenge) {
      setTimeout(() => {
        scrollToBottom();
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTop = container.scrollHeight;
          // Check if at bottom and clear unread count
          checkIfAtBottom();
        }
      }, 200);
    }
  }, [viewingChat, activeChallenge?._id, scrollToBottom, checkIfAtBottom]);

  // Ensure scroll container is focusable and scrollable on mount
  useEffect(() => {
    if (viewingChat && messagesContainerRef.current) {
      // Make the container focusable for keyboard scrolling
      messagesContainerRef.current.setAttribute('tabindex', '-1');
      // Ensure it can receive focus programmatically
      messagesContainerRef.current.style.outline = 'none';
      
      // Force a reflow to ensure the container is properly rendered and scrollable
      // This fixes the issue where scrolling doesn't work until after clicking the input
      setTimeout(() => {
        if (messagesContainerRef.current) {
          // Trigger a layout recalculation
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollTop;
        }
      }, 100);
    }
  }, [viewingChat, messages.length]);

  // Scroll to bottom when entering chat view or when active challenge changes
  useEffect(() => {
    if (viewingChat && activeChallenge && messagesContainerRef.current) {
      // Scroll to bottom when entering chat view to show recent messages
      setTimeout(() => {
        scrollToBottom();
        // Check if at bottom and clear unread count when entering chat
        checkIfAtBottom();
      }, 100);
    }
  }, [viewingChat, activeChallenge?._id, scrollToBottom, checkIfAtBottom]);

  // Fetch user challenges on component mount
  useEffect(() => {
    if (user?.sub) {
      fetchUserChallenges();
    }
  }, [user?.sub]);

  // Set active challenge when challenges are loaded or when selectedChallenge changes
  useEffect(() => {
    if (userChallenges.length > 0 || completedChallenges.length > 0) {
      if (selectedChallenge && (userChallenges.find(c => c._id === selectedChallenge._id) || completedChallenges.find(c => c._id === selectedChallenge._id))) {
        setActiveChallengeId(selectedChallenge._id);
        setActiveChallenge(selectedChallenge);
      } else {
        if (userChallenges.length > 0) {
          const firstActive = userChallenges[0];
          setActiveChallengeId(firstActive._id);
          setActiveChallenge(firstActive);
        } else if (completedChallenges.length > 0) {
          const firstCompleted = completedChallenges[0];
          setActiveChallengeId(firstCompleted._id);
          setActiveChallenge(firstCompleted);
        }
      }
    }
  }, [userChallenges, completedChallenges, selectedChallenge]);

  // Automatically open chat window if user has only one active challenge
  useEffect(() => {
    // Only auto-open if:
    // 1. We have exactly one active challenge
    // 2. We're not already viewing chat
    // 3. We have an active challenge set
    // 4. We've finished fetching challenges (hasEverBeenReadyRef is true)
    // 5. User hasn't manually closed the chat
    if (
      userChallenges.length === 1 &&
      completedChallenges.length === 0 &&
      !viewingChat &&
      activeChallenge &&
      hasEverBeenReadyRef.current &&
      !userManuallyClosedChatRef.current
    ) {
      setViewingChat(true);
    }
  }, [userChallenges.length, completedChallenges.length, viewingChat, activeChallenge]);

  // Initialize chat when active challenge changes
  // Only fetch if cache is stale or challenge hasn't been initialized yet
  useEffect(() => {
    if (activeChallenge?._id) {
      const lastSync = chatService.getLastSync(activeChallenge._id);
      const cacheAge = Date.now() - lastSync;
      const isCacheStale = cacheAge > 120000; // 2 minutes
      const hasCache = chatService.loadFromCache(activeChallenge._id).length > 0;
      
      // Only initialize if:
      // 1. Challenge hasn't been initialized yet, OR
      // 2. Cache is stale (older than 2 minutes), OR
      // 3. No cache exists
      // Note: We don't mark as initialized when just loading from cache - only after successful fetch
      if (!initializedChallengesRef.current.has(activeChallenge._id) || isCacheStale || !hasCache) {
        // Remove from initialized set if cache is stale, so we can fetch again
        if (isCacheStale && initializedChallengesRef.current.has(activeChallenge._id)) {
          initializedChallengesRef.current.delete(activeChallenge._id);
        }
        initializeChat();
      }
    }
  }, [activeChallenge?._id]);

  // Set up periodic refresh for new messages
  useEffect(() => {
    if (!activeChallenge || !isConnected || !user?.sub) return;
    
    const refreshInterval = setInterval(async () => {
      // Double-check user is still logged in before making API call
      if (!user?.sub) {
        return;
      }
      try {
        // Check if there are new messages
        const checkResult = await chatService.checkForNewMessages(activeChallenge._id);
        
        // If new messages detected, fetch all messages
        if (checkResult && checkResult.hasNew) {
          const allMessages = await chatService.fetchMessages(activeChallenge._id, true); // Force refresh
          setMessages(allMessages);
          
          // If user is at bottom, clear unread count and update last seen
          if (isAtBottomRef.current) {
            lastSeenMessageCountRef.current = allMessages.length;
            // Clear unread count when new messages arrive and user is at bottom
            if (unreadCount > 0) {
              markAllAsRead();
            }
          }
        }
      } catch (error) {
        console.log('Error checking for new messages:', error);
      }
    }, 3000); // Check every 3 seconds for better real-time feel
    
    return () => clearInterval(refreshInterval);
  }, [activeChallenge, isConnected, user?.sub]);

  // Fetch user challenges
  const fetchUserChallenges = async () => {
    if (!user?.sub) return;

    // Check cache first
    const hasCached = sessionStorage.getItem('fitapp_chat_userChallenges') || sessionStorage.getItem('fitapp_chat_completedChallenges')
    if (!hasCached) {
      setFetchingChallenges(true);
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
      
      const response = await fetch(`${apiUrl}/api/user-challenges/${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fitapp_jwt_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const active = data.filter(c => new Date(c.endDate) >= new Date());
        const completed = data.filter(c => new Date(c.endDate) < new Date());
        
        setUserChallenges(active);
        setCompletedChallenges(completed);
        hasEverBeenReadyRef.current = true
      } else {
        console.error('Failed to fetch challenges');
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setFetchingChallenges(false);
    }
  };

  // Initialize chat for a challenge
  const initializeChat = async () => {
    if (!activeChallenge || !activeChallenge._id) {
      return;
    }
    
    // If already initialized, just ensure cache is loaded
    if (initializedChallengesRef.current.has(activeChallenge._id)) {
      const cachedMessages = chatService.loadFromCache(activeChallenge._id);
      if (cachedMessages.length > 0 && messages.length === 0) {
        setMessages(cachedMessages);
        setIsConnected(true);
        setLoading(false);
        lastSeenMessageCountRef.current = cachedMessages.length;
      }
      return; // Don't fetch again if already initialized
    }
    
    // Check if we have fresh cache (less than 2 minutes old)
    const lastSync = chatService.getLastSync(activeChallenge._id);
    const cacheAge = Date.now() - lastSync;
    const hasFreshCache = cacheAge < 120000 && messages.length > 0; // 2 minutes
    
    try {
      // Only show loading if we don't have fresh cache
      if (!hasFreshCache) {
        setLoading(true);
      }
      setError(null);
      
      // Load existing messages from cache/API
      // fetchMessages will use cache if it's fresh (< 2 minutes), otherwise fetch from API
      const existingMessages = await chatService.fetchMessages(activeChallenge._id, false);
      
      setMessages(existingMessages || []);
      
      // Update last seen message count when loading messages
      if (existingMessages && existingMessages.length > 0) {
        lastSeenMessageCountRef.current = existingMessages.length;
      }
      
      // Set connected state
      setIsConnected(true);
      hasEverBeenReadyRef.current = true;
      
      // Mark this challenge as initialized
      initializedChallengesRef.current.add(activeChallenge._id);
      
    } catch (error) {
      console.error('Error initializing chat:', error);
      setError('Failed to load chat messages');
      // If error, still mark as initialized to prevent retry loops
      initializedChallengesRef.current.add(activeChallenge._id);
    } finally {
      setLoading(false);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChallenge || saving) return;
    
    try {
      setSaving(true);
      
      const messageData = {
        sender: user.name || user.email,
        message: newMessage.trim(),
        timestamp: new Date().toISOString(),
        userPicture: user.picture,
        userId: user.sub, // Add userId to properly identify the sender
        userEmail: user.email // Add userEmail for backend verification
      };
      
      // Send message using chat service
      const savedMessage = await chatService.sendMessage(activeChallenge._id, messageData);
      
      // Add the new message to the local state immediately (optimistic update)
      setMessages(prev => [...prev, savedMessage]);
      
      // Immediately refresh messages to get the latest from server (ensures all users see it)
      try {
        const refreshedMessages = await chatService.fetchMessages(activeChallenge._id, true); // Force refresh
        setMessages(refreshedMessages);
        
        // Update last seen message count if user is at bottom (they just sent a message)
        if (isAtBottomRef.current) {
          lastSeenMessageCountRef.current = refreshedMessages.length;
        }
      } catch (refreshError) {
        console.log('Error refreshing messages after send:', refreshError);
        // Keep the optimistic update if refresh fails
      }
      
      // Clear input
      setNewMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSaving(false);
    }
  };

  // Handle challenge selection
  const handleChallengeSelect = (challenge) => {
    setActiveChallengeId(challenge._id);
    setActiveChallenge(challenge);
    // Reset the manual close flag when user selects a challenge
    userManuallyClosedChatRef.current = false;
    // Load cached messages immediately for this challenge
    const cachedMessages = chatService.loadFromCache(challenge._id);
    if (cachedMessages.length > 0) {
      setMessages(cachedMessages);
      setIsConnected(true);
      setLoading(false);
      lastSeenMessageCountRef.current = cachedMessages.length;
    }
    setViewingChat(true);
  };

  // Toggle completed challenges visibility
  const toggleCompletedChallenges = () => {
    setShowCompletedChallenges(!showCompletedChallenges);
  };

  // Format timestamp - only show time, no "Just now" or dates
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    // Don't show anything for messages less than 1 hour old
    if (diffInHours < 1) {
      return null;
    }
    // Show time for messages from today
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Parse markdown-style links [text](url) and render as clickable links
  const parseMessageLinks = (text) => {
    if (!text) return text;
    
    // Regular expression to match markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      
      // Add the link
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push({ type: 'link', text: linkText, url: linkUrl });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last link
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    
    // If no links found, return original text
    if (parts.length === 0) {
      return text;
    }
    
    // Render parts as React elements
    return parts.map((part, index) => {
      if (part.type === 'link') {
        return (
          <a
            key={index}
            href={part.url}
            onClick={(e) => {
              e.preventDefault();
              navigate(part.url);
            }}
            className="underline text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {part.text}
          </a>
        );
      }
      return <span key={index}>{part.content}</span>;
    });
  };

  // Check if two timestamps are on different days
  const isDifferentDay = (timestamp1, timestamp2) => {
    if (!timestamp1 || !timestamp2) return true;
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return (
      date1.getFullYear() !== date2.getFullYear() ||
      date1.getMonth() !== date2.getMonth() ||
      date1.getDate() !== date2.getDate()
    );
  };

  // Format date for day header
  const formatDayHeader = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p>Please log in to access chat.</p>
        </div>
      </MainLayout>
    );
  }

  // Loading state while fetching challenges
  if (fetchingChallenges && !hasEverBeenReadyRef.current) {
    return (
      <div className={unifiedDesignSystem.components.layout.appContainer.className}>
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // No challenges state
  if (userChallenges.length === 0 && completedChallenges.length === 0) {
    return (
      <div className={unifiedDesignSystem.components.layout.appContainer.className}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-blue-500 mb-4">
              <svg width="64" height="64" fill="currentColor" viewBox="0 0 20 20" className="mx-auto">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Challenges</h2>
            <p className="text-gray-600 mb-4">You need to join or create a challenge to access the chat.</p>
            <div className="space-x-3">
              <Button variant="primary" onClick={() => navigate('/challenges')}>
                Join Challenge
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat view - when a challenge is selected
  if (viewingChat && activeChallenge) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 overflow-hidden">
        {/* Fixed Header - Always at top, edge-to-edge */}
        <div className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-sm">
          <div className="relative flex items-center max-w-4xl mx-auto px-4 sm:px-6 py-4">
            {/* Back Arrow Button - Top Left */}
            <button
              onClick={() => {
                userManuallyClosedChatRef.current = true;
                setViewingChat(false);
              }}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 text-gray-600 hover:text-gray-900 flex-shrink-0 z-10"
              aria-label="Back to Challenge List"
            >
              <svg 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                className="w-5 h-5 sm:w-6 sm:h-6"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 19l-7-7 7-7" 
                />
              </svg>
            </button>
            
            {/* Centered Header Content - Absolutely positioned for true centering */}
            <div className="absolute left-0 right-0 flex flex-col items-center justify-center pointer-events-none">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                {activeChallenge.name}
              </h1>
              {new Date(activeChallenge.endDate) < new Date() && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20" className="mr-1">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Ended {new Date(activeChallenge.endDate).toLocaleDateString()}
                  </div>
                  <span className="text-xs text-gray-500">(View Only)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Container - Scrollable area with padding for fixed header and input */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto pt-16"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
            paddingBottom: new Date(activeChallenge.endDate) < new Date() 
              ? '200px' // More space for ended challenges
              : (isInputFocused ? '120px' : '160px')
          }}
        >
          <div className="px-4 sm:px-6 py-2 max-w-4xl mx-auto w-full">
            {/* Completed Challenge Notice */}
            {new Date(activeChallenge.endDate) < new Date() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2 text-blue-800">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">
                    Viewing chat history from completed challenge. This challenge ended on {new Date(activeChallenge.endDate).toLocaleDateString()}.
                  </span>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {/* No messages state */}
              {messages.length === 0 && !loading && (
                <div key="no-messages" className="text-center py-8 text-gray-500">
                  <svg width="48" height="48" fill="currentColor" viewBox="0 0 20 20" className="mx-auto mb-3 opacity-50">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Start the conversation!</p>
                </div>
              )}
              
              {/* Loading indicator for initial load */}
              {loading && messages.length === 0 && !hasEverBeenReadyRef.current && (
                <div key="loading-indicator" className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              )}
              
              {/* Message count for performance */}
              {messages.length > 50 && (
                <div key="message-count" className="text-center text-xs text-gray-400 py-2">
                  Showing {messages.length} messages
                </div>
              )}
              
              {/* Messages list */}
              {messages.map((msg, index) => {
                // Check if this is a bot message first - bot messages are never "own" messages
                const isBotMessage = msg.isBot || false;
                
                // Use userId for comparison if available, fallback to sender name/email
                // Bot messages should never be considered "own" messages, even if userId matches
                const isOwnMessage = isBotMessage ? false : (msg.userId ? msg.userId === user.sub : (msg.sender === user.name || msg.sender === user.email));
                
                // Get bot avatar from challenge if it's a bot message
                const botAvatar = activeChallenge?.botAvatar || '🤖';
                const isBotAvatarEmoji = botAvatar && !botAvatar.startsWith('http') && !botAvatar.startsWith('/');
                
                // Determine the avatar to use
                const messageAvatar = isBotMessage 
                  ? (isBotAvatarEmoji ? null : botAvatar) // Use botAvatar URL if it's an image, otherwise null to show emoji
                  : msg.userPicture;
                
                // Check if this is the first message or if it's a new day
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const showDayHeader = !prevMessage || isDifferentDay(prevMessage.timestamp, msg.timestamp);
                
                // Check if message is a card type
                const isCardMessage = msg.messageType && msg.messageType !== 'text';
                
                if (isCardMessage) {
                  // Get gradient based on card type
                  const getCardGradient = (cardType) => {
                    const gradients = {
                      stepGoalCard: 'bg-gradient-to-r from-green-500 to-emerald-600',
                      dailyStepUpdateCard: 'bg-gradient-to-r from-blue-500 to-blue-600',
                      weighInReminderCard: 'bg-gradient-to-r from-blue-500 to-blue-800', // Match dashboard card gradient
                      weightLossCard: 'bg-gradient-to-r from-pink-500 to-rose-600',
                      welcomeCard: 'bg-gradient-to-r from-blue-500 to-cyan-600',
                      startReminderCard: 'bg-gradient-to-r from-orange-500 to-amber-600',
                      winnerCard: 'bg-gradient-to-r from-yellow-500 to-orange-600',
                      leaveCard: 'bg-gradient-to-r from-gray-500 to-gray-600'
                    };
                    return gradients[cardType] || 'bg-gradient-to-r from-blue-500 to-blue-600';
                  };

                  // Handle card click - navigate to leaderboard or dashboard
                  const handleCardClick = () => {
                    if (activeChallenge) {
                      // Save challenge to context before navigating
                      saveChallenge(activeChallenge);
                      navigate('/leaderboard');
                    }
                  };
                  
                  // Handle weigh-in reminder card click - navigate to dashboard and open weight modal
                  const handleWeighInCardClick = () => {
                    if (activeChallenge) {
                      // Save challenge to context before navigating
                      saveChallenge(activeChallenge);
                      // Navigate to dashboard with query parameter to open weight modal
                      navigate('/dashboard?openWeightModal=true');
                    }
                  };
                  
                  // Render card based on type
                  const renderCard = () => {
                    const gradient = getCardGradient(msg.messageType);
                    // For cards, always use the user's profile picture (the user mentioned in the card)
                    const cardAvatar = msg.userPicture;
                    const hasProfilePhoto = cardAvatar && (msg.messageType === 'stepGoalCard' || msg.messageType === 'weightLossCard' || msg.messageType === 'welcomeCard' || msg.messageType === 'winnerCard');
                    
                    // Check if this is a milestone card that should be clickable
                    const isMilestoneCard = msg.messageType === 'stepGoalCard' || 
                                           msg.messageType === 'weightLossCard' || 
                                           msg.messageType === 'welcomeCard' || 
                                           msg.messageType === 'winnerCard';
                    
                    // Check if this is a weigh-in reminder card (clickable to navigate to dashboard)
                    const isWeighInReminderCard = msg.messageType === 'weighInReminderCard';
                    
                    const baseCardClasses = `w-full max-w-[80%] sm:max-w-xs lg:max-w-md aspect-[3/1] ${gradient} rounded-2xl p-3 shadow-lg flex items-center space-x-3`;
                    const clickableClasses = (isMilestoneCard || isWeighInReminderCard) ? 'cursor-pointer hover:scale-105 transition-transform duration-200' : '';
                    const cardClasses = `${baseCardClasses} ${clickableClasses}`;
                    
                    const cardProps = isMilestoneCard ? {
                      onClick: handleCardClick
                    } : isWeighInReminderCard ? {
                      onClick: handleWeighInCardClick
                    } : {};
                    
                    if (msg.messageType === 'stepGoalCard') {
                      return (
                        <div {...cardProps} className={cardClasses}>
                          {/* Profile Photo */}
                          <div className="flex-shrink-0">
                            {cardAvatar ? (
                              <img
                                src={cardAvatar}
                                alt={msg.cardData?.userName || 'User'}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 border-3 border-white flex items-center justify-center">
                                <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Card Content */}
                          <div className="flex-1 text-white min-w-0">
                            <div className="text-[10px] font-medium opacity-90 mb-0.5">
                              {msg.cardData?.achievement || 'Achievement Unlocked!'}
                            </div>
                            <div className="text-sm font-bold truncate">
                              {msg.cardData?.userName || 'Someone'}
                            </div>
                            <div className="text-xs opacity-90">
                              {msg.cardData?.stepCount?.toLocaleString()} steps
                            </div>
                          </div>
                          
                          {/* +1 Point Badge */}
                          <div className="flex-shrink-0">
                            <div className="bg-white bg-opacity-25 rounded-full w-10 h-10 flex items-center justify-center border-2 border-white">
                              <span className="text-white font-bold text-sm">+1</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Weight Loss Card
                    if (msg.messageType === 'weightLossCard') {
                      return (
                        <div {...cardProps} className={cardClasses}>
                          {hasProfilePhoto && (
                            <div className="flex-shrink-0">
                              {cardAvatar ? (
                                <img
                                  src={cardAvatar}
                                  alt={msg.cardData?.userName || 'User'}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 text-white min-w-0">
                            <div className="text-[10px] font-medium opacity-90 mb-0.5">
                              Weight Loss Achievement
                            </div>
                            <div className="text-sm font-bold truncate">
                              {msg.cardData?.userName || 'Someone'}
                            </div>
                            <div className="text-xs opacity-90">
                              Lost {msg.cardData?.weightLost} lbs
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="bg-white bg-opacity-25 rounded-full w-10 h-10 flex items-center justify-center border-2 border-white">
                              <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Welcome Card
                    if (msg.messageType === 'welcomeCard') {
                      return (
                        <div {...cardProps} className={cardClasses}>
                          {hasProfilePhoto && (
                            <div className="flex-shrink-0">
                              {cardAvatar ? (
                                <img
                                  src={cardAvatar}
                                  alt={msg.cardData?.userName || 'User'}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 text-white min-w-0">
                            <div className="text-[10px] font-medium opacity-90 mb-0.5">
                              Welcome to the Challenge
                            </div>
                            <div className="text-sm font-bold truncate">
                              {msg.cardData?.userName || 'New Member'}
                            </div>
                            <div className="text-xs opacity-90 truncate">
                              {msg.cardData?.challengeName || 'Challenge'}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white opacity-75">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                          </div>
                        </div>
                      );
                    }
                    
                    // Winner Card
                    if (msg.messageType === 'winnerCard') {
                      return (
                        <div {...cardProps} className={cardClasses}>
                          {hasProfilePhoto && (
                            <div className="flex-shrink-0">
                              {cardAvatar ? (
                                <img
                                  src={cardAvatar}
                                  alt={msg.cardData?.userName || 'User'}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 text-white min-w-0">
                            <div className="text-[10px] font-medium opacity-90 mb-0.5">
                              Challenge Winner
                            </div>
                            <div className="text-sm font-bold truncate">
                              {msg.cardData?.userName || 'Winner'}
                            </div>
                            <div className="text-xs opacity-90">
                              {msg.cardData?.totalPoints} points
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="bg-white bg-opacity-25 rounded-full w-10 h-10 flex items-center justify-center border-2 border-white">
                              <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Leave Card
                    if (msg.messageType === 'leaveCard') {
                      return (
                        <div className={`w-full max-w-[80%] sm:max-w-xs lg:max-w-md aspect-[3/1] ${gradient} rounded-2xl p-3 shadow-lg flex items-center space-x-3`}>
                          {hasProfilePhoto && (
                            <div className="flex-shrink-0">
                              {cardAvatar ? (
                                <img
                                  src={cardAvatar}
                                  alt={msg.cardData?.userName || 'User'}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 text-white min-w-0">
                            <div className="text-[10px] font-medium opacity-90 mb-0.5">
                              Left the Challenge
                            </div>
                            <div className="text-sm font-bold truncate">
                              {msg.cardData?.userName || 'Member'}
                            </div>
                            <div className="text-xs opacity-90 truncate">
                              {msg.cardData?.challengeName || 'Challenge'}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-white opacity-75">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      );
                    }
                    
                    // Weigh-in reminder card (clickable)
                    if (msg.messageType === 'weighInReminderCard') {
                      return (
                        <div {...cardProps} className={cardClasses}>
                          <div className="text-white text-center flex-1">
                            <div className="text-sm font-bold mb-0.5">
                              {msg.cardData?.title || 'Weigh-In Day!'}
                            </div>
                            <div className="text-xs opacity-90">
                              {msg.cardData?.subtitle || 'Log your current weight'}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Generic card for other types (dailyStepUpdateCard, startReminderCard)
                    return (
                      <div className={`w-full max-w-[80%] sm:max-w-xs lg:max-w-md aspect-[3/1] ${gradient} rounded-2xl p-3 shadow-lg flex items-center justify-center`}>
                        <div className="text-white text-center">
                          <div className="text-sm font-bold mb-0.5">
                            {msg.cardData?.title || msg.cardData?.challengeName || 'Notification'}
                          </div>
                          <div className="text-xs opacity-90">
                            {msg.cardData?.subtitle || msg.cardData?.message || ''}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <Fragment key={msg.id || `${msg.timestamp}-${index}`}>
                      {/* Day Header if needed */}
                      {showDayHeader && (
                        <div className="flex items-center justify-center my-6">
                          <div className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-medium">
                            {formatDayHeader(msg.timestamp)}
                          </div>
                        </div>
                      )}
                      
                      {/* Card */}
                      <div className="flex justify-center mb-2">
                        {renderCard()}
                      </div>
                      
                      {/* Text Message Below Card - Always shown as other user (gray bubble) */}
                      <div
                        className="flex justify-start items-end space-x-2 mb-4"
                      >
                        {/* Profile Photo - Always show on left */}
                        <div className="flex-shrink-0">
                          {messageAvatar ? (
                            <img
                              src={messageAvatar}
                              alt={msg.sender}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          {!messageAvatar && (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full border-2 border-gray-200 flex items-center justify-center">
                              {isBotMessage && isBotAvatarEmoji ? (
                                <span className="text-lg">{botAvatar}</span>
                              ) : (
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-gray-600">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Message Bubble - Always gray */}
                        <div
                          className="max-w-[80%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-2xl bg-gray-100 text-gray-800"
                        >
                          <div className="text-xs font-medium mb-1 text-gray-500">
                            {msg.sender ? msg.sender.split(' ')[0] : 'Bot'}
                          </div>
                          <div className="text-sm break-words whitespace-pre-wrap">{parseMessageLinks(msg.message)}</div>
                          {formatTime(msg.timestamp) && (
                            <div className="text-xs mt-1 text-gray-500">
                              {formatTime(msg.timestamp)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Fragment>
                  );
                }
                
                return (
                <Fragment key={msg.id || `${msg.timestamp}-${index}`}>
                  {/* Day Header */}
                  {showDayHeader && (
                    <div className="flex items-center justify-center my-6">
                      <div className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-medium">
                        {formatDayHeader(msg.timestamp)}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-end space-x-2 mb-4`}
                  >
                  {/* Profile Photo - Only show for non-own messages */}
                  {!isOwnMessage && (
                    <div className="flex-shrink-0">
                      {messageAvatar ? (
                        <img
                          src={messageAvatar}
                          alt={msg.sender}
                          className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      {!messageAvatar && (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full border-2 border-gray-200 flex items-center justify-center">
                          {isBotMessage && isBotAvatarEmoji ? (
                            <span className="text-lg">{botAvatar}</span>
                          ) : (
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-gray-600">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[80%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-2xl ${
                      isOwnMessage
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {msg.sender ? msg.sender.split(' ')[0] : 'Unknown'}
                    </div>
                    <div className="text-sm break-words whitespace-pre-wrap">{parseMessageLinks(msg.message)}</div>
                    {formatTime(msg.timestamp) && (
                      <div className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                  
                  {/* Profile Photo for own messages - Right side */}
                  {isOwnMessage && (
                    <div className="flex-shrink-0">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover border-2 border-blue-300"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      {!user.picture && (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-300 to-blue-400 rounded-full border-2 border-blue-300 flex items-center justify-center">
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-white">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </Fragment>
              )})}
              <div ref={messagesEndRef} style={{ minHeight: '1px', paddingBottom: '20px' }} />
            </div>
          </div>
        </div>

        {/* Message Input - Fixed above navigation bar, moves to bottom when focused */}
        <div className={`fixed ${isInputFocused ? 'bottom-0' : 'bottom-24'} left-0 right-0 z-[1001] bg-white border-t border-gray-200 px-4 sm:px-4 ${new Date(activeChallenge.endDate) < new Date() ? 'py-3 sm:py-2' : 'py-6 sm:py-4'} shadow-lg transition-all duration-200`}>
          <div className="max-w-4xl mx-auto">
            {new Date(activeChallenge.endDate) < new Date() ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs sm:text-sm font-medium">
                    This challenge ended on {new Date(activeChallenge.endDate).toLocaleDateString()}. 
                    You can view the chat history but cannot send new messages.
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  style={{ fontSize: '16px' }}
                  disabled={!isConnected || saving}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || !isConnected || saving}
                  size="md"
                  className="flex-shrink-0"
                >
                  <span className="hidden sm:inline">Send</span>
                  <span className="sm:hidden">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </span>
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Challenge list view - main screen with navigation
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Fixed Header - Always at top, edge-to-edge */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-sm">
        <div className="relative flex items-center max-w-4xl mx-auto px-4 sm:px-6 py-10">

          
          {/* Centered Header Content - Absolutely positioned for true centering */}
          <div className="absolute left-0 right-0 flex flex-col items-center justify-center pointer-events-none">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">
              Challenge Chats
            </h1>
            <p className="text-sm text-gray-500">Select a challenge to start chatting</p>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <MainLayout>
        <div className="min-h-screen pt-20">
          {/* Challenge List - Takes remaining space */}
          <div className="flex-1 overflow-y-auto px-1 sm:px-6 py-4">
            {/* Active Challenges Section */}
            {userChallenges.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Active Challenges
                </h2>
                <div className="space-y-3">
                  {userChallenges.map((challenge) => (
                    <div
                      key={challenge._id}
                      onClick={() => handleChallengeSelect(challenge)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center space-x-4">
                        {/* Challenge Photo */}
                        <div className="flex-shrink-0">
                          {challenge.photo ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com'}${challenge.photo}`}
                              alt={challenge.name}
                              className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          {!challenge.photo && (
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg border border-gray-200 flex items-center justify-center">
                              <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-blue-600">
                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Challenge Info */}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">{challenge.name}</h3>
                          <div className="text-sm text-gray-500">
                            <span>{new Date(challenge.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(challenge.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="text-gray-400">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Challenges Section */}
            {completedChallenges.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                    Completed Challenges
                  </h2>
                  <button
                    onClick={toggleCompletedChallenges}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
                  >
                    {showCompletedChallenges ? 'Hide' : 'Show'} ({completedChallenges.length})
                  </button>
                </div>
                
                {showCompletedChallenges && (
                  <div className="space-y-3">
                    {completedChallenges.map((challenge) => (
                      <div
                        key={challenge._id}
                        onClick={() => handleChallengeSelect(challenge)}
                        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer opacity-75 hover:opacity-100"
                      >
                        <div className="flex items-center space-x-4">
                          {/* Challenge Photo */}
                          <div className="flex-shrink-0">
                            {challenge.photo ? (
                              <img
                                src={`${import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com'}${challenge.photo}`}
                                alt={challenge.name}
                                className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            {!challenge.photo && (
                              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-200 flex items-center justify-center">
                                <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-gray-600">
                                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Challenge Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 mb-1">{challenge.name}</h3>
                            <div className="text-sm text-gray-500">
                              <span>{new Date(challenge.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(challenge.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          
                          {/* Status Indicator */}
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="text-gray-400">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {userChallenges.length === 0 && completedChallenges.length === 0 && !fetchingChallenges && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg width="64" height="64" fill="currentColor" viewBox="0 0 20 20" className="mx-auto">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Challenges Found</h3>
                <p className="text-gray-500 mb-4">You haven't joined any challenges yet.</p>
                <Button variant="primary" onClick={() => navigate('/challenges')}>
                  Join a Challenge
                </Button>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </div>
  );
};

export default Chat;