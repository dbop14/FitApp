import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Custom hook that handles page visibility changes and triggers smart refetching
 * Works in conjunction with React Query's refetchOnWindowFocus
 * 
 * This ensures data is refreshed when:
 * - User returns to the tab after being away
 * - Tab becomes visible after being hidden
 * - Works even if browser throttles background tabs
 */
export const useVisibilityRefetch = () => {
  const queryClient = useQueryClient()
  const lastVisibilityChange = useRef(Date.now())
  const wasHidden = useRef(false)

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      const now = Date.now()
      const timeSinceLastChange = now - lastVisibilityChange.current

      if (isVisible && wasHidden.current) {
        // Tab became visible after being hidden
        const minutesHidden = Math.floor(timeSinceLastChange / (60 * 1000))
        
        console.log(`👁️ Tab became visible after ${minutesHidden} minute(s) - triggering smart refetch`)
        
        // If tab was hidden for more than 1 minute, refetch all queries
        // This ensures fresh data when user returns
        if (timeSinceLastChange > 60 * 1000) {
          // Refetch all active queries that are stale
          queryClient.refetchQueries({
            type: 'active', // Only refetch active queries (currently mounted)
            stale: true, // Only refetch if data is stale
          })
          
          console.log('🔄 Smart refetch triggered for stale queries')
        }
        
        wasHidden.current = false
      } else if (!isVisible) {
        // Tab became hidden
        wasHidden.current = true
        console.log('👁️ Tab became hidden')
      }
      
      lastVisibilityChange.current = now
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also listen for focus events as a fallback
    const handleFocus = () => {
      const now = Date.now()
      const timeSinceLastChange = now - lastVisibilityChange.current
      
      // If window was focused after being away for more than 1 minute
      if (timeSinceLastChange > 60 * 1000 && wasHidden.current) {
        console.log('👁️ Window focused after being away - triggering smart refetch')
        queryClient.refetchQueries({
          type: 'active',
          stale: true,
        })
        wasHidden.current = false
      }
      
      lastVisibilityChange.current = now
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [queryClient])
}
