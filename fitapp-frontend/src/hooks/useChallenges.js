import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

export const useChallenges = () => {
  const { user } = useContext(UserContext)
  const queryClient = useQueryClient()
  
  return useQuery({
    queryKey: ['challenges', user?.sub],
    queryFn: async () => {
      if (!user?.sub) {
        return []
      }
      
      const apiUrl = getApiUrl()
      const response = await fetchWithAuth(`${apiUrl}/api/user-challenges/${user.sub}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch challenges')
      }
      
      const challenges = await response.json()
      // Filter out deleted challenges
      return challenges.filter(c => c && !c._deleted)
    },
    enabled: !!user?.sub,
    staleTime: 2 * 60 * 1000, // 2 minutes - challenges change less frequently
    // Periodic polling: refetch every 10 minutes for background updates
    // Challenges change less frequently than user data, so longer interval
    refetchInterval: (query) => {
      // Only poll if user is logged in and query is enabled
      return user?.sub ? 10 * 60 * 1000 : false // 10 minutes
    },
    // Show cached data immediately while fetching fresh data in background
    // This implements stale-while-revalidate pattern
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      const cachedData = queryClient.getQueryData(['challenges', user?.sub])
      return cachedData || previousData
    },
  })
}

