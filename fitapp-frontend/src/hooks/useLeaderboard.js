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
    staleTime: 30 * 1000, // 30 seconds - so refocus or remount picks up backfill/sync updates
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: true, // Refetch when tab gains focus (e.g. after running backfill script)
    refetchOnMount: true, // Refetch when component mounts if data is stale
    retry: 1,
  })
}

