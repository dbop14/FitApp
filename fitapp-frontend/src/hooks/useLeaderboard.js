import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

/**
 * Hook to fetch leaderboard data for a challenge with caching
 * Uses React Query to cache data and reduce loading states
 */
export const useLeaderboard = (challengeId) => {
  const { user } = useContext(UserContext)
  
  return useQuery({
    queryKey: ['leaderboard', challengeId, user?.sub],
    queryFn: async () => {
      if (!challengeId || !user?.sub) {
        return []
      }
      
      const apiUrl = getApiUrl()
      
      // First, update participant data
      await fetch(`${apiUrl}/api/update-participant/${challengeId}/${user.sub}`, {
        method: 'POST'
      }).catch(() => {}) // Ignore errors on update
      
      // Then fetch leaderboard
      const response = await fetchWithAuth(`${apiUrl}/api/leaderboard/${challengeId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status}`)
      }
      
      return await response.json()
    },
    enabled: !!challengeId && !!user?.sub,
    staleTime: 1 * 60 * 1000, // 1 minute - leaderboard changes more frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Use cache if data is fresh
    retry: 1,
  })
}

