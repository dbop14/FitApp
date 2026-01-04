import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext, useEffect, useRef } from 'react'
import { UserContext } from '../context/UserContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

// Helper function to silently send analytics without logging errors
// Disabled by default - set localStorage flag 'enable_analytics' to 'true' to enable
const silentAnalytics = (url, data) => {
  // Only send if explicitly enabled via localStorage flag
  // Check localStorage safely in case it's not available
  let analyticsEnabled = false
  try {
    analyticsEnabled = localStorage.getItem('enable_analytics') === 'true'
  } catch (e) {
    // localStorage not available, disable analytics
  }
  
  if (!analyticsEnabled) {
    return // Don't make requests if analytics is disabled
  }
  
  // Use fetch with keepalive and catch to minimize error logging
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    keepalive: true
  }).catch(() => {
    // Silently ignore errors - analytics service may not be available
  })
}

export const useUserData = () => {
  const { user, setUser } = useContext(UserContext)
  const queryClient = useQueryClient()
  const eventSourceRef = useRef(null)
  const currentUserIdRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const sseUpdateTimeoutRef = useRef(null)
  const pendingSSEUpdateRef = useRef(null)
  
  const query = useQuery({
    queryKey: ['userData', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return null
      
      const apiUrl = getApiUrl()
      const response = await fetchWithAuth(`${apiUrl}/api/user/userdata?googleId=${user.sub}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }
      
      const data = await response.json()
      
      return {
        steps: data.steps,
        weight: data.weight,
        lastSync: data.lastSync
      }
    },
    enabled: !!user?.sub, // Only run if user exists
    staleTime: 2 * 60 * 1000, // 2 minutes (matches global config)
    // Periodic polling: refetch every 5 minutes for background updates
    // This ensures data stays fresh even when user is inactive
    refetchInterval: (query) => {
      // Only poll if user is logged in and query is enabled
      // Polling continues even when tab is in background (with browser limitations)
      return user?.sub ? 5 * 60 * 1000 : false // 5 minutes
    },
    // Show cached data immediately while fetching fresh data in background
    // This implements stale-while-revalidate pattern
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      const cachedData = queryClient.getQueryData(['userData', user?.sub])
      return cachedData || previousData
    },
  })
  
  // Helper function to close connection cleanly
  const closeConnection = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Clear SSE update debounce timeout
    if (sseUpdateTimeoutRef.current) {
      clearTimeout(sseUpdateTimeoutRef.current)
      sseUpdateTimeoutRef.current = null
    }
    pendingSSEUpdateRef.current = null
    
    if (eventSourceRef.current) {
      try {
        // Only close if connection is still open
        if (eventSourceRef.current.readyState !== EventSource.CLOSED) {
          eventSourceRef.current.close()
        }
      } catch (error) {
        // Ignore errors when closing
        console.debug('Error closing EventSource:', error)
      }
      eventSourceRef.current = null
    }
    isConnectingRef.current = false
  }
  
  // Helper function to establish SSE connection
  const establishConnection = () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || !user?.sub) {
      return
    }
    
    const apiUrl = getApiUrl()
    const jwtToken = localStorage.getItem('fitapp_jwt_token')
    
    if (!jwtToken) {
      console.log('⚠️ No JWT token found, skipping SSE connection')
      return
    }
    
    // Check if we already have a connection for this user
    if (eventSourceRef.current && currentUserIdRef.current === user.sub) {
      const readyState = eventSourceRef.current.readyState
      // If connection is open or connecting, don't create a new one
      if (readyState === EventSource.OPEN || readyState === EventSource.CONNECTING) {
        console.log('🔌 SSE connection already exists and is active')
        return
      }
    }
    
    // Close existing connection if user changed or connection is dead
    if (eventSourceRef.current && currentUserIdRef.current !== user.sub) {
      console.log('🔄 User changed, closing old connection')
      closeConnection()
    }
    
    isConnectingRef.current = true
    currentUserIdRef.current = user.sub
    
    // Create SSE connection with token as query parameter
    // EventSource doesn't support custom headers, so we use query param
    const eventSourceUrl = `${apiUrl}/api/realtime/events/${user.sub}?token=${encodeURIComponent(jwtToken)}`
    
    console.log('🔌 Connecting to SSE endpoint:', eventSourceUrl.replace(jwtToken, 'TOKEN'))
    
    const eventSource = new EventSource(eventSourceUrl)
    eventSourceRef.current = eventSource
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened')
      isConnectingRef.current = false
      reconnectAttemptsRef.current = 0 // Reset on successful connection
    }
    
    eventSource.onmessage = (event) => {
      try {
        // Handle connection keep-alive messages
        if (event.data.startsWith(':')) {
          return
        }
        
        const { type, data } = JSON.parse(event.data)
        
        if (type === 'userData') {
          // Debounce rapid SSE updates - store the latest update and process after 200ms
          // This prevents rapid flickering when backend sends multiple updates (e.g., when saving history)
          pendingSSEUpdateRef.current = data
          
          // Clear any existing timeout
          if (sseUpdateTimeoutRef.current) {
            clearTimeout(sseUpdateTimeoutRef.current)
          }
          
          // Process the latest update after a short delay
          sseUpdateTimeoutRef.current = setTimeout(() => {
            const latestData = pendingSSEUpdateRef.current
            if (!latestData) return
            
            // Update React Query cache with latest data
            queryClient.setQueryData(['userData', user.sub], (oldData) => {
              // Only update if data actually changed
              if (oldData && 
                  oldData.steps === latestData.steps && 
                  oldData.weight === latestData.weight &&
                  oldData.lastSync === latestData.lastSync) {
                return oldData // No change, return existing data
              }
              
              return {
                ...(oldData || {}),
                steps: latestData.steps,
                weight: latestData.weight,
                lastSync: latestData.lastSync
              }
            })
            
            // Also update UserContext if setUser is available
            // Use functional update to avoid dependency issues
            if (setUser) {
              setUser(prev => {
                // Only update if data actually changed to prevent unnecessary re-renders
                // Handle lastSync - it might be a Date object or a string
                const prevLastSyncTime = prev?.lastSync 
                  ? (prev.lastSync instanceof Date ? prev.lastSync.getTime() : new Date(prev.lastSync).getTime())
                  : null
                const newLastSyncTime = latestData.lastSync 
                  ? new Date(latestData.lastSync).getTime() 
                  : null
                
                const willUpdate = prev && (
                  prev.steps !== latestData.steps ||
                  prev.weight !== latestData.weight ||
                  prevLastSyncTime !== newLastSyncTime
                )
                
                if (willUpdate) {
                  return {
                    ...prev,
                    steps: latestData.steps,
                    weight: latestData.weight,
                    lastSync: latestData.lastSync ? new Date(latestData.lastSync) : prev.lastSync
                  }
                }
                return prev
              })
            }
            
            // Clear pending update
            pendingSSEUpdateRef.current = null
          }, 200) // 200ms debounce - enough to batch rapid updates
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      const readyState = eventSource.readyState
      isConnectingRef.current = false
      
      if (readyState === EventSource.CLOSED) {
        console.log('🔄 SSE connection closed')
        
        // Only attempt manual reconnect if user is still logged in
        // and we don't already have a reconnect scheduled
        if (user?.sub && currentUserIdRef.current === user.sub && !reconnectTimeoutRef.current) {
          // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
          const maxDelay = 30000
          const baseDelay = 1000
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
          reconnectAttemptsRef.current++
          
          console.log(`🔄 Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            // Only reconnect if user hasn't changed
            if (user?.sub && currentUserIdRef.current === user.sub) {
              establishConnection()
            }
          }, delay)
        }
      } else if (readyState === EventSource.CONNECTING) {
        console.log('🔄 SSE connection is reconnecting...')
        // EventSource is handling reconnection automatically
      }
    }
  }
  
  // Set up SSE connection for real-time updates
  // Only depend on user.sub - not on setUser or queryClient to prevent unnecessary reconnections
  useEffect(() => {
    if (!user?.sub) {
      // Clean up if user logs out
      closeConnection()
      currentUserIdRef.current = null
      return
    }
    
    // Only establish connection if user changed or no connection exists
    if (currentUserIdRef.current !== user.sub || !eventSourceRef.current) {
      establishConnection()
    }
    
    return () => {
      // Only close connection if user actually changed or component unmounting
      // Don't close on every render - only when user changes or unmounting
      if (!user?.sub || currentUserIdRef.current !== user?.sub) {
        console.log('🔌 Cleaning up SSE connection')
        closeConnection()
        currentUserIdRef.current = null
      }
    }
  }, [user?.sub]) // Only depend on user.sub - removed queryClient and setUser
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection()
      currentUserIdRef.current = null
    }
  }, [])
  
  return query
}


