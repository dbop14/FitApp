import React, { useContext, useEffect, useLayoutEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { ChallengeContext } from '../context/ChallengeContext';
import { useChatNotifications } from '../context/ChatNotificationContext';
import Button from '../components/ui/Button';
import { chatService } from '../utils/chatService';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ThemeToggle from '../components/ui/ThemeToggle';

// Bot / user avatar beside a message
const MessageAvatar = ({ isBot, src, name }) =>
  isBot && !src ? (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink" aria-hidden="true">
      <Icon name="bot" className="h-4 w-4" />
    </span>
  ) : (
    <Avatar src={src} name={name} size="sm" />
  );

const DayHeader = ({ label }) => (
  <div className="my-5 flex items-center justify-center">
    <span className="chip chip-neutral px-3 py-1 text-xs">{label}</span>
  </div>
);

const ChallengeRow = ({ challenge, ended, onSelect, apiBase }) => (
  <button
    type="button"
    onClick={() => onSelect(challenge)}
    className={`list-row w-full text-left transition-colors hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2 ${ended ? 'opacity-80' : ''}`}
  >
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-800">
      {challenge.photo ? (
        <img
          src={`${apiBase}${challenge.photo}`}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white">
          <Icon name="trophy" className="h-6 w-6" />
        </span>
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold text-ink">{challenge.name}</span>
      <span className="block text-sm text-ink-muted">
        {new Date(challenge.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(challenge.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    </span>
    <span className={`h-2.5 w-2.5 rounded-full ${ended ? 'bg-[rgb(var(--line-strong))]' : 'bg-teal-500'}`} aria-label={ended ? 'Ended' : 'Active'} />
    <Icon name="chevron-right" className="h-5 w-5 text-ink-subtle" />
  </button>
);


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
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
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
  // Note: Cache may be pruned, so we'll fetch fresh from API in initializeChat
  useEffect(() => {
    if (activeChallenge?._id) {
      // Load from cache immediately (synchronously) for instant display
      // This is just for quick UI feedback - initializeChat will fetch complete data
      const cachedMessages = chatService.loadFromCache(activeChallenge._id);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
        setIsConnected(true);
        // Don't set loading to false here - let initializeChat handle it after fetching complete data
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
      } catch (e) {
        // Ignore storage errors - chatService handles quota errors internally
        console.warn('Failed to save to chatService cache:', e);
      }
      
      // Also update sessionStorage for backward compatibility (with error handling)
      // Skip sessionStorage on iOS PWAs due to very strict quotas
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (!isIOS) {
        try {
          const cacheKey = `fitapp_chat_messages_${activeChallenge._id}`
          const cappedMessages = chatService.pruneMessages(messages, chatService.maxCachedMessages || 200);
          sessionStorage.setItem(cacheKey, JSON.stringify({
            messages: cappedMessages,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore sessionStorage errors - not critical
          if (e?.name === 'QuotaExceededError') {
            // Try to clear old sessionStorage entries
            try {
              const keysToRemove = [];
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('fitapp_chat_messages_') && key !== `fitapp_chat_messages_${activeChallenge._id}`) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => sessionStorage.removeItem(key));
              // Retry once after cleanup with even smaller cache
              const cacheKey = `fitapp_chat_messages_${activeChallenge._id}`
              const cappedMessages = chatService.pruneMessages(messages, 25); // Very small cache
              sessionStorage.setItem(cacheKey, JSON.stringify({
                messages: cappedMessages,
                timestamp: Date.now()
              }))
            } catch (retryError) {
              // Give up on sessionStorage caching - it's not critical
              // Silently fail to avoid console spam
            }
          }
        }
      }
    }
  }, [messages, activeChallenge?._id])
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMessageTimestampRef = useRef(null);
  const inputRef = useRef(null);
  const lastSeenMessageCountRef = useRef(0); // Track last seen message count to detect new messages
  const isAtBottomRef = useRef(true); // Track if user is at bottom of messages
  const isInitialLoadRef = useRef(true); // Track if this is the initial load for the current challenge

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

  // Instant scroll to bottom (no animation) - for initial load
  const scrollToBottomInstant = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      checkIfAtBottom();
    }
  }, [checkIfAtBottom]);

  // Smooth scroll to bottom - for new messages while viewing
  const scrollToBottomSmooth = useCallback(() => {
    if (messagesEndRef.current) {
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
        scrollToBottomInstant();
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
  }, [isInputFocused, viewingChat, scrollToBottomInstant]);

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

  // Set initial scroll position to bottom (no animation) - runs before paint
  useLayoutEffect(() => {
    if (viewingChat && messagesContainerRef.current && messages.length > 0) {
      // On initial load, set scroll position instantly without animation
      if (isInitialLoadRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
        checkIfAtBottom();
        isInitialLoadRef.current = false;
      } else {
        // For new messages while viewing, only scroll if user is at bottom
        if (isAtBottomRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTop = container.scrollHeight;
          checkIfAtBottom();
        }
      }
    }
  }, [messages.length, viewingChat, checkIfAtBottom]);

  // Reset initial load flag when challenge changes
  useEffect(() => {
    if (activeChallenge?._id) {
      isInitialLoadRef.current = true;
      setHasLoadedMessages(false);
    }
  }, [activeChallenge?._id]);

  // Ensure scroll container is focusable and scrollable on mount
  useEffect(() => {
    if (viewingChat && messagesContainerRef.current) {
      // Make the container focusable for keyboard scrolling
      messagesContainerRef.current.setAttribute('tabindex', '-1');
      // Ensure it can receive focus programmatically
      messagesContainerRef.current.style.outline = 'none';
    }
  }, [viewingChat]);

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
  useEffect(() => {
    if (activeChallenge) {
      initializeChat();
    }
  }, [activeChallenge]);

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
        // Silently handle network errors - they're expected on iOS PWAs
        // Only log non-network errors
        if (error?.name !== 'TypeError' || !error?.message?.includes('Load failed')) {
          console.log('Error checking for new messages:', error);
        }
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
    
    // Check cache first (skip sessionStorage on iOS due to strict quotas)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) {
      try {
        const cacheKey = `fitapp_chat_messages_${activeChallenge._id}`
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.messages) {
            setMessages(parsed.messages)
            setIsConnected(true)
            hasEverBeenReadyRef.current = true
            setLoading(false) // Show cached messages immediately
            // Still fetch fresh data in background
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      if (!hasEverBeenReadyRef.current) {
        setLoading(true);
      }
      setError(null);
      
      // Load existing messages from API (force refresh to ensure we have all messages)
      // Cache may be pruned, so always fetch from API on initialization
      const existingMessages = await chatService.fetchMessages(activeChallenge._id, true);
      
      setMessages(existingMessages || []);
      setHasLoadedMessages(true);
      
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
      setHasLoadedMessages(true);
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
      <>
        <PageHeader title="Chat" />
        <div className="page">
          <EmptyState icon="lock" title="Please log in to access chat." />
        </div>
      </>
    );
  }

  // Loading state while fetching challenges
  if (fetchingChallenges && !hasEverBeenReadyRef.current) {
    return (
      <>
        <PageHeader title="Chats" />
        <div className="page-narrow space-y-3" aria-busy="true">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      </>
    );
  }

  // No challenges state
  if (userChallenges.length === 0 && completedChallenges.length === 0) {
    return (
      <>
        <PageHeader title="Chats" />
        <div className="page-narrow">
          <EmptyState
            icon="chat"
            title="No active challenges"
            action={
              <Button variant="primary" onClick={() => navigate('/challenges')}>
                <Icon name="trophy" className="h-4 w-4" />
                Join a challenge
              </Button>
            }
          >
            Join or create a challenge to chat with your group.
          </EmptyState>
        </div>
      </>
    );
  }

  // Chat view - when a challenge is selected
  if (viewingChat && activeChallenge) {
    const challengeEnded = new Date(activeChallenge.endDate) < new Date();

    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-canvas md:left-sidebar-rail lg:left-sidebar">
        {/* Header */}
        <header className="z-20 shrink-0 bg-gradient-to-r from-blue-500 to-blue-800 text-white shadow-brand safe-area-header">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-3 pb-3 sm:px-6">
            <button
              onClick={() => {
                userManuallyClosedChatRef.current = true;
                setViewingChat(false);
              }}
              className="icon-btn-on-brand -ml-1"
              aria-label="Back to chats"
            >
              <Icon name="chevron-left" className="h-6 w-6" />
            </button>
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[rgb(255_255_255/0.16)]">
              {activeChallenge.photo ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com'}${activeChallenge.photo}`}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Icon name="trophy" className="h-5 w-5" />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-white sm:text-lg">{activeChallenge.name}</h1>
              <p className="truncate text-xs text-blue-100">
                {challengeEnded
                  ? `Ended ${new Date(activeChallenge.endDate).toLocaleDateString()} · View only`
                  : isConnected
                    ? 'Group chat'
                    : 'Connecting...'}
              </p>
            </div>
            <ThemeToggle variant="brand" className="md:hidden" />
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        >
          <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-6">
            {challengeEnded && (
              <div className="callout callout-info mb-4">
                <Icon name="archive" className="mt-0.5 h-5 w-5 shrink-0" />
                <p>Chat history from a completed challenge. It ended on {new Date(activeChallenge.endDate).toLocaleDateString()}.</p>
              </div>
            )}

            {messages.length === 0 && !loading && hasLoadedMessages && (
              <div key="no-messages" className="flex flex-col items-center py-12 text-center text-ink-muted">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                  <Icon name="chat" className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-ink">No messages yet</p>
                <p className="text-xs">Start the conversation.</p>
              </div>
            )}

            {loading && messages.length === 0 && !hasEverBeenReadyRef.current && (
              <div key="loading-indicator" className="flex justify-center py-10">
                <LoadingSpinner />
              </div>
            )}

            {messages.length > 50 && (
              <div key="message-count" className="py-2 text-center text-xs text-ink-subtle">
                Showing {messages.length} messages
              </div>
            )}

            {messages.map((msg, index) => {
              // Bot messages are never "own" messages
              const isBotMessage = msg.isBot || false;
              const isOwnMessage = isBotMessage ? false : (msg.userId ? msg.userId === user.sub : (msg.sender === user.name || msg.sender === user.email));

              // Bot avatar: only an image URL is shown; emoji avatars render as the bot icon
              const botAvatar = activeChallenge?.botAvatar || '';
              const botAvatarIsImage = botAvatar.startsWith('http') || botAvatar.startsWith('/');
              const messageAvatar = isBotMessage ? (botAvatarIsImage ? botAvatar : null) : msg.userPicture;

              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDayHeader = !prevMessage || isDifferentDay(prevMessage.timestamp, msg.timestamp);
              const isCardMessage = msg.messageType && msg.messageType !== 'text';

              if (isCardMessage) {
                // Card styles: brand blues for points and reminders, teal accent for weight loss
                const CARD_STYLE = {
                  stepGoalCard: { bg: 'from-blue-500 to-blue-800', icon: 'target', label: 'Step goal reached' },
                  goalBonusCard: { bg: 'from-blue-500 to-blue-800', icon: 'target', label: 'Daily goal bonus' },
                  weeklyBonusCard: { bg: 'from-blue-600 to-blue-900', icon: 'calendar-check', label: 'Weekly bonus' },
                  dailyStepUpdateCard: { bg: 'from-blue-400 to-blue-600', icon: 'steps' },
                  weighInReminderCard: { bg: 'from-blue-500 to-blue-800', icon: 'scale' },
                  weightLossCard: { bg: 'from-teal-500 to-teal-700', icon: 'trending-down', label: 'Weight loss achievement' },
                  welcomeCard: { bg: 'from-blue-400 to-blue-600', icon: 'users', label: 'Welcome to the challenge' },
                  startReminderCard: { bg: 'from-blue-400 to-blue-600', icon: 'flag' },
                  winnerCard: { bg: 'from-blue-700 to-blue-900', icon: 'crown', label: 'Challenge winner' },
                  leaveCard: { bg: 'from-gray-500 to-gray-600', icon: 'log-out', label: 'Left the challenge' },
                };
                const style = CARD_STYLE[msg.messageType] || { bg: 'from-blue-500 to-blue-600', icon: 'bell' };

                // Milestone cards open the leaderboard
                const handleCardClick = () => {
                  if (activeChallenge) {
                    saveChallenge(activeChallenge);
                    navigate('/leaderboard');
                  }
                };
                // Weigh-in reminder opens the dashboard weight modal
                const handleWeighInCardClick = () => {
                  if (activeChallenge) {
                    saveChallenge(activeChallenge);
                    navigate('/dashboard?openWeightModal=true');
                  }
                };

                const renderCard = () => {
                  const cardAvatar = msg.userPicture;
                  const isPointsCard = ['stepGoalCard', 'goalBonusCard', 'weeklyBonusCard'].includes(msg.messageType);
                  const isMilestoneCard = isPointsCard || ['weightLossCard', 'welcomeCard', 'winnerCard'].includes(msg.messageType);
                  const isWeighInReminderCard = msg.messageType === 'weighInReminderCard';
                  const onClick = isMilestoneCard ? handleCardClick : isWeighInReminderCard ? handleWeighInCardClick : undefined;
                  const showPerson = isMilestoneCard || msg.messageType === 'leaveCard';

                  let eyebrow = style.label;
                  let title = msg.cardData?.userName || 'Someone';
                  let detail = '';
                  let badge = null;

                  if (isPointsCard) {
                    eyebrow = msg.cardData?.achievement || style.label;
                    detail = msg.messageType === 'weeklyBonusCard'
                      ? `${msg.cardData?.activeDays ?? ''} active days in week ${msg.cardData?.weekNumber ?? ''}`
                      : `${msg.cardData?.stepCount?.toLocaleString() ?? ''} steps`;
                    // Points come from the backend; Classic step-goal cards carry none, so show a check
                    badge = msg.cardData?.points !== undefined && msg.cardData?.points !== null
                      ? <span className="text-sm font-bold">+{msg.cardData.points}</span>
                      : <Icon name="check" className="h-5 w-5" strokeWidth={2.5} />;
                  } else if (msg.messageType === 'weightLossCard') {
                    detail = `Lost ${msg.cardData?.weightLost} lbs`;
                    badge = <Icon name="trending-down" className="h-5 w-5" />;
                  } else if (msg.messageType === 'welcomeCard') {
                    title = msg.cardData?.userName || 'New member';
                    detail = msg.cardData?.challengeName || 'Challenge';
                  } else if (msg.messageType === 'winnerCard') {
                    title = msg.cardData?.userName || 'Winner';
                    detail = `${msg.cardData?.totalPoints} points`;
                    badge = <Icon name="crown" className="h-5 w-5" />;
                  } else if (msg.messageType === 'leaveCard') {
                    title = msg.cardData?.userName || 'Member';
                    detail = msg.cardData?.challengeName || 'Challenge';
                  } else if (isWeighInReminderCard) {
                    eyebrow = null;
                    title = msg.cardData?.title || 'Weigh-in day';
                    detail = msg.cardData?.subtitle || 'Log your current weight';
                  } else {
                    // dailyStepUpdateCard, startReminderCard and anything new
                    eyebrow = null;
                    title = msg.cardData?.title || msg.cardData?.challengeName || 'Notification';
                    detail = msg.cardData?.subtitle || msg.cardData?.message || '';
                  }

                  const Tag = onClick ? 'button' : 'div';
                  return (
                    <Tag
                      type={onClick ? 'button' : undefined}
                      onClick={onClick}
                      className={`flex w-full max-w-sm items-center gap-3 rounded-2xl bg-gradient-to-br ${style.bg} p-3.5 text-left text-white shadow-brand ${
                        onClick ? 'transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300' : ''
                      }`}
                    >
                      {showPerson ? (
                        <span className="relative shrink-0">
                          <Avatar src={cardAvatar} name={msg.cardData?.userName} size="lg" className="ring-2 ring-[rgb(255_255_255/0.6)]" />
                          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#fff] text-blue-700 shadow">
                            <Icon name={style.icon} className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </span>
                        </span>
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(255_255_255/0.18)]">
                          <Icon name={style.icon} className="h-6 w-6" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        {eyebrow && <span className="block text-[11px] font-semibold uppercase tracking-wide text-[rgb(255_255_255/0.8)]">{eyebrow}</span>}
                        <span className="block truncate text-sm font-bold">{title}</span>
                        {detail && <span className="block truncate text-xs text-[rgb(255_255_255/0.85)]">{detail}</span>}
                      </span>
                      {badge && (
                        <span className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full bg-[rgb(255_255_255/0.2)] px-2 ring-1 ring-[rgb(255_255_255/0.5)]">
                          {badge}
                        </span>
                      )}
                    </Tag>
                  );
                };

                return (
                  <Fragment key={msg.id || `${msg.timestamp}-${index}`}>
                    {showDayHeader && <DayHeader label={formatDayHeader(msg.timestamp)} />}
                    <div className="mb-2 flex justify-center">{renderCard()}</div>
                    {/* Text under the card, shown as an incoming message */}
                    <div className="mb-4 flex items-end justify-start gap-2">
                      <MessageAvatar isBot={isBotMessage} src={messageAvatar} name={msg.sender} />
                      <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2 text-ink shadow-card sm:max-w-md">
                        <div className="mb-0.5 text-xs font-semibold text-ink-muted">{msg.sender ? msg.sender.split(' ')[0] : 'Bot'}</div>
                        <div className="whitespace-pre-wrap break-words text-sm">{parseMessageLinks(msg.message)}</div>
                        {formatTime(msg.timestamp) && <div className="mt-1 text-[11px] text-ink-subtle">{formatTime(msg.timestamp)}</div>}
                      </div>
                    </div>
                  </Fragment>
                );
              }

              return (
                <Fragment key={msg.id || `${msg.timestamp}-${index}`}>
                  {showDayHeader && <DayHeader label={formatDayHeader(msg.timestamp)} />}
                  <div className={`mb-3 flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    {!isOwnMessage && <MessageAvatar isBot={isBotMessage} src={messageAvatar} name={msg.sender} />}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 sm:max-w-md ${
                        isOwnMessage
                          ? 'rounded-br-md bg-blue-600 text-white'
                          : 'rounded-bl-md border border-line bg-surface text-ink shadow-card'
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className={`mb-0.5 text-xs font-semibold ${isBotMessage ? 'text-brand-ink' : 'text-ink-muted'}`}>
                          {msg.sender ? msg.sender.split(' ')[0] : 'Unknown'}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words text-sm">{parseMessageLinks(msg.message)}</div>
                      {formatTime(msg.timestamp) && (
                        <div className={`mt-1 text-[11px] ${isOwnMessage ? 'text-blue-100' : 'text-ink-subtle'}`}>{formatTime(msg.timestamp)}</div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
            <div ref={messagesEndRef} style={{ minHeight: '1px', paddingBottom: '8px' }} />
          </div>
        </div>

        {/* Composer. On phones it sits above the tab bar, which hides while typing. */}
        <div
          className={`z-20 shrink-0 border-t border-line bg-surface px-3 py-3 sm:px-6 md:mb-0 md:pb-3 ${
            isInputFocused ? 'mb-0 pb-[calc(0.75rem+var(--safe-area-bottom))]' : 'mb-[calc(4rem+var(--safe-area-bottom))]'
          }`}
        >
          <div className="mx-auto max-w-4xl">
            {challengeEnded ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-center text-xs font-medium text-ink-muted sm:text-sm">
                <Icon name="lock" className="h-4 w-4 shrink-0" />
                <span>This challenge ended on {new Date(activeChallenge.endDate).toLocaleDateString()}. You can read the history but not send new messages.</span>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="Message"
                  className="input flex-1 rounded-full px-4 text-base"
                  style={{ fontSize: '16px' }}
                  disabled={!isConnected || saving}
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || !isConnected || saving}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Icon name="send" className="h-5 w-5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Challenge list view
  const apiBase = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
  return (
    <>
      <PageHeader title="Chats" subtitle="Pick a challenge to open its group chat" />

      <div className="page-narrow space-y-6">
        {userChallenges.length > 0 && (
          <section aria-labelledby="chats-active">
            <h2 id="chats-active" className="section-title mb-2 px-1">Active</h2>
            <div className="card list-divided overflow-hidden">
              {userChallenges.map((challenge) => (
                <ChallengeRow key={challenge._id} challenge={challenge} onSelect={handleChallengeSelect} apiBase={apiBase} />
              ))}
            </div>
          </section>
        )}

        {completedChallenges.length > 0 && (
          <section aria-labelledby="chats-completed">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 id="chats-completed" className="section-title">Completed</h2>
              <button onClick={toggleCompletedChallenges} className="btn btn-sm btn-ghost" aria-expanded={showCompletedChallenges}>
                {showCompletedChallenges ? 'Hide' : 'Show'} ({completedChallenges.length})
                <Icon name="chevron-down" className={`h-4 w-4 transition-transform ${showCompletedChallenges ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showCompletedChallenges && (
              <div className="card list-divided overflow-hidden">
                {completedChallenges.map((challenge) => (
                  <ChallengeRow key={challenge._id} challenge={challenge} ended onSelect={handleChallengeSelect} apiBase={apiBase} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
};

export default Chat;
