import React, { useState, useEffect, useContext, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChallenge } from '../context/ChallengeContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import UserCard from '../components/ui/UserCard'
import ProgressCard from '../components/ui/ProgressCard'
import StatCard from '../components/ui/StatCard'
import WeightInputModal from '../components/WeightInputModal'
import { useUserData } from '../hooks/useUserData'
import { useChallenges } from '../hooks/useChallenges'
import { useQueryClient } from '@tanstack/react-query'

// #region agent log
const debugLog = (payload) => {
  const apiUrl = getApiUrl()
  fetch(`${apiUrl}/api/debug-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session' }) }).catch(() => {})
}
// #endregion

/**
 * Dashboard Component - Refactored to align with unified design system
 * 
 * Design System Implementation:
 * - Layout: Follows designSystem.layout.appContainer and pageContainer patterns
 * - Components: Implements designSystem.components.cards (statCard, userCard, progressCard)
 * - Styling: Applies designSystem.colorPalette.gradients and typography hierarchy
 * - Structure: Follows designSystem.layoutPatterns.dashboard structure
 * 
 * API Integration Preserved:
 * - User challenges and participant data fetching
 * - User rank and leaderboard data
 * - Auto-refresh functionality
 * - Post-login data synchronization
 */

const Dashboard = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, setUser, lastDataRefresh, autoRefreshUserData, getTodaysStepGoalStatus, getStepProgress, syncGoogleFitData } = useContext(UserContext)
  const { challenge: activeChallengeFromContext, clearChallenge } = useChallenge()
  const queryClient = useQueryClient()
  
  // Use React Query hooks for data fetching
  // Use isFetching instead of isLoading to show cached data immediately
  const { data: userData, isLoading: userDataLoading, isFetching: userDataFetching } = useUserData()
  const { data: challengesData, isLoading: challengesLoading, isFetching: challengesFetching } = useChallenges()
  
  // Initialize state from cache if available (for instant display on navigation)
  const [userRank, setUserRank] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fitapp_dashboard_userRank')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [participantData, setParticipantData] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fitapp_dashboard_participantData')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [isLoadingParticipantData, setIsLoadingParticipantData] = useState(false) // Track participant fetch separately
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState(null)
  const abortControllerRef = useRef(null) // Track AbortController for request cancellation
  const isFetchingRef = useRef(false) // Track if fetch is in progress to prevent concurrent requests
  const [shouldPromptForWeight, setShouldPromptForWeight] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [mostRecentWeight, setMostRecentWeight] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fitapp_dashboard_mostRecentWeight')
      return cached ? parseFloat(cached) : null
    } catch {
      return null
    }
  })
  const [isLoadingWeight, setIsLoadingWeight] = useState(false) // Track weight fetch separately
  const hasEverBeenReadyRef = useRef(false) // Track if we've ever been ready (one-way gate)
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(() => {
    // If we have cached data, consider initial load complete
    try {
      const hasCachedRank = sessionStorage.getItem('fitapp_dashboard_userRank')
      const hasCachedParticipant = sessionStorage.getItem('fitapp_dashboard_participantData')
      return !!(hasCachedRank || hasCachedParticipant)
    } catch {
      return false
    }
  })
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(() => {
    // If we have cached data, don't show loading
    try {
      const hasCachedRank = sessionStorage.getItem('fitapp_dashboard_userRank')
      const hasCachedParticipant = sessionStorage.getItem('fitapp_dashboard_participantData')
      return !(hasCachedRank || hasCachedParticipant)
    } catch {
      return true
    }
  })
  
  // Cache userRank when it changes
  useEffect(() => {
    if (userRank !== null) {
      try {
        sessionStorage.setItem('fitapp_dashboard_userRank', JSON.stringify(userRank))
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [userRank])
  
  // Cache participantData when it changes
  useEffect(() => {
    if (participantData !== null) {
      try {
        sessionStorage.setItem('fitapp_dashboard_participantData', JSON.stringify(participantData))
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [participantData])
  
  // Cache mostRecentWeight when it changes
  useEffect(() => {
    if (mostRecentWeight !== null) {
      try {
        sessionStorage.setItem('fitapp_dashboard_mostRecentWeight', mostRecentWeight.toString())
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [mostRecentWeight])
  
  // Process challenges data from React Query - filter to only active challenges
  // Memoize to prevent unnecessary re-renders that trigger useEffect
  const userChallenges = useMemo(() => {
    if (!challengesData) return []
    return challengesData
      .filter(challenge => {
        if (!challenge || challenge._deleted) return false
        // Only include active challenges (not completed)
        if (challenge.endDate) {
          const now = new Date()
          const endDate = new Date(challenge.endDate)
          return endDate >= now
        }
        // Challenges without endDate are considered ongoing/active
        return true
      })
      .sort((a, b) => {
        if (!a.endDate && !b.endDate) return 0
        if (!a.endDate) return -1
        if (!b.endDate) return 1
        return new Date(b.endDate) - new Date(a.endDate)
      })
  }, [challengesData])
  
  // Update user data in context when React Query data changes
  useEffect(() => {
    if (userData && user) {
      // UserContext will be updated via the SSE connection in useUserData hook
      // But we can also sync here if needed
    }
  }, [userData, user])
  
  // Fetch participant data and rank when challenges change
  useEffect(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return
    }
    
    const fetchParticipantData = async () => {
      if (!user?.sub || !userChallenges.length) {
        setActiveChallenge(null)
        setParticipantData(null)
        // Mark as loaded if we have user data (even if no challenges)
        if (user?.sub && isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
        return
      }
      
      // Check if JWT token exists
      const jwtToken = localStorage.getItem('fitapp_jwt_token');
      if (!jwtToken) {
        console.log('🔒 No JWT token found, skipping data fetch');
        // Mark as loaded even without token (we can't fetch, but we've determined state)
        if (isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
        return;
      }
      
      try {
        const apiUrl = getApiUrl()
        
        // Prioritize active challenge from context, fallback to first active challenge
        let challengeToUse = null
        
        // First, validate that the active challenge (from context) still exists and is active
        // If it doesn't exist in userChallenges, immediately clear it
        if (activeChallengeFromContext?._id) {
          const challengeStillExists = userChallenges.some(c => c._id === activeChallengeFromContext._id)
          
          if (!challengeStillExists) {
            // Challenge doesn't exist in the filtered list - clear it immediately
            console.log('🗑️ Challenge from context does not exist in active challenges - clearing immediately')
            clearChallenge()
            // Don't use this challenge - fall through to use first active challenge
          } else {
            // Challenge exists - check if it's active and use the version from filtered list
            const contextChallengeInList = userChallenges.find(c => c._id === activeChallengeFromContext._id)
            const now = new Date()
            const isContextChallengeActive = !contextChallengeInList?.endDate || new Date(contextChallengeInList.endDate) >= now
            
            if (isContextChallengeActive && contextChallengeInList) {
              // Use the version from userChallenges (filtered list) to ensure latest data
              challengeToUse = contextChallengeInList
            } else {
              console.log('🗑️ Active challenge from context is no longer active, clearing from context')
              clearChallenge()
            }
          }
        }
        
        // Fallback to first active challenge if no active challenge from context
        // If there are multiple challenges with the same name, prefer the most recent one (latest endDate or no endDate)
        if (!challengeToUse && userChallenges.length > 0) {
          // Sort by endDate descending (most recent first), then by _id for consistency
          const sortedChallenges = [...userChallenges].sort((a, b) => {
            if (!a.endDate && !b.endDate) {
              // Both have no endDate, sort by _id for consistency
              return a._id.localeCompare(b._id)
            }
            if (!a.endDate) return -1 // No endDate comes first (ongoing)
            if (!b.endDate) return 1
            const dateDiff = new Date(b.endDate) - new Date(a.endDate)
            if (dateDiff !== 0) return dateDiff
            // Same endDate, sort by _id for consistency
            return a._id.localeCompare(b._id)
          })
          
          challengeToUse = sortedChallenges[0]
        }
        
        if (!challengeToUse) {
          setActiveChallenge(null)
          setParticipantData(null)
          // Mark as loaded if we have user data
          if (user?.sub && isLoadingInitialData) {
            setIsLoadingInitialData(false)
            setHasInitialDataLoaded(true)
          }
          return
        }
        
        const challengeId = challengeToUse._id
        setActiveChallenge(challengeToUse)
        
        // Create new AbortController for this request
        const abortController = new AbortController()
        abortControllerRef.current = abortController
        isFetchingRef.current = true
        
        setIsLoadingParticipantData(true)
        // Fetch participant data with abort signal
        let participantResponse
        try {
          participantResponse = await fetchWithAuth(`${apiUrl}/api/challenge/${challengeId}/participant/${user.sub}`, {
            signal: abortController.signal
          })
        } catch (fetchErr) {
          if (fetchErr.name === 'AbortError') {
            // Request was cancelled, don't update state
            return
          }
          throw fetchErr
        }
        if (participantResponse.ok) {
          const participant = await participantResponse.json()
          setParticipantData(participant.participant)
        } else {
          // If fetch fails, set to null to indicate no data (not loading)
          setParticipantData(null)
        }
        setIsLoadingParticipantData(false)
        
        // Fetch user's ranking in this specific challenge
        let leaderboardResponse
        try {
          leaderboardResponse = await fetchWithAuth(`${apiUrl}/api/leaderboard/${challengeId}`, {
            signal: abortController.signal
          })
        } catch (fetchErr) {
          if (fetchErr.name === 'AbortError') {
            // Request was cancelled, don't update state
            return
          }
          throw fetchErr
        }
        if (leaderboardResponse.ok) {
          const leaderboard = await leaderboardResponse.json()
          const userEntry = leaderboard.find(entry => entry.userId === user.sub)
          if (userEntry) {
            // Calculate rank if not provided by backend (fallback for old API responses)
            let rank = userEntry.rank;
            if (!rank && rank !== 0) {
              // Fallback: calculate rank from position in sorted leaderboard
              rank = leaderboard.findIndex(entry => entry.userId === user.sub) + 1;
            }
            
            setUserRank({
              rank: rank || 'N/A',
              totalPoints: userEntry.totalPoints || userEntry.points || 0,
              participants: leaderboard.length
            })
          } else {
            setUserRank(null); // Reset rank if not found
          }
        } else {
          // If fetch fails, set to null to indicate no data (not loading)
          setUserRank(null)
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (err.name === 'AbortError') {
          return
        }
        console.error('Failed to fetch participant data:', err)
        // Set to null to indicate no data (not loading)
        setParticipantData(null)
        setUserRank(null)
        setIsLoadingParticipantData(false)
      } finally {
        // Reset fetch tracking
        isFetchingRef.current = false
        abortControllerRef.current = null
        // Mark initial loading as complete AFTER all fetches complete
        if (isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
      }
    }
    
    fetchParticipantData()
    
    return () => {
      // Cancel any in-flight requests when effect cleanup runs
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      isFetchingRef.current = false
    }
  }, [userChallenges, user?.sub, activeChallengeFromContext, clearChallenge])
  
  // Fetch overall user rank (fallback when no challenges)
  useEffect(() => {
    const fetchUserRank = async () => {
      if (!user?.sub || userChallenges.length > 0) {
        // Mark as loaded if we have user data but no challenges
        if (user?.sub && isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
        return
      }
      
      const jwtToken = localStorage.getItem('fitapp_jwt_token');
      if (!jwtToken) {
        if (isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
        return
      }
      
      try {
        const apiUrl = getApiUrl()
        const rankResponse = await fetchWithAuth(`${apiUrl}/api/user-rank/${user.sub}`)
        if (rankResponse.ok) {
          const rankData = await rankResponse.json()
          setUserRank(rankData)
        }
      } catch (err) {
        console.error('Failed to fetch user rank:', err)
        // Mark as loaded even on error so we don't block forever
        if (isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
      } finally {
        if (isLoadingInitialData) {
          setIsLoadingInitialData(false)
          setHasInitialDataLoaded(true)
        }
      }
    }
    
    fetchUserRank()
  }, [userChallenges.length, user?.sub])

  // Fetch most recent weight from history when current weight is null so the Weight card
  // can show the most recent value from Google Fit/Fitbit (including when in a challenge).
  useEffect(() => {
    const fetchMostRecentWeight = async () => {
      // Only fetch if not in a challenge and current weight is null/undefined
      if (activeChallenge || !user?.sub) {
        setMostRecentWeight(null)
        setIsLoadingWeight(false)
        // If in a challenge, weight comes from participantData (handled by participant fetch)
        return
      }
      
      // Use userData if available, otherwise fallback to user from context
      const currentWeight = (userData || user)?.weight
      if (currentWeight !== null && currentWeight !== undefined) {
        // Already have current weight, no need to fetch from history
        setMostRecentWeight(null)
        setIsLoadingWeight(false)
        return
      }
      
      const jwtToken = localStorage.getItem('fitapp_jwt_token');
      if (!jwtToken) {
        setIsLoadingWeight(false)
        return
      }
      
      setIsLoadingWeight(true)
      try {
        const apiUrl = getApiUrl()
        const historyResponse = await fetchWithAuth(`${apiUrl}/api/user/fitness-history/${user.sub}?limit=30`)
        
        if (historyResponse.ok) {
          const history = await historyResponse.json()
          const mostRecentWeightEntry = history.find(entry => entry.weight !== null && entry.weight !== undefined)
          
          if (mostRecentWeightEntry && mostRecentWeightEntry.weight) {
            setMostRecentWeight(mostRecentWeightEntry.weight)
          } else {
            setMostRecentWeight(null)
          }
        }
      } catch (err) {
        console.error('Failed to fetch most recent weight:', err)
        setMostRecentWeight(null)
      } finally {
        setIsLoadingWeight(false)
      }
    }
    
    fetchMostRecentWeight()
  }, [user?.sub, user?.weight, userData?.weight])

  // Auto-refresh user data when Dashboard page loads
  useEffect(() => {
    if (user?.sub && autoRefreshUserData) {
      const lastAutoRefresh = sessionStorage.getItem('fitapp_last_auto_refresh');
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      // Force refresh if no fitness data exists or if enough time has passed
      const hasNoFitnessData = user.steps === null || user.steps === undefined || user.weight === null || user.weight === undefined;
      const shouldForceRefresh = !lastAutoRefresh || parseInt(lastAutoRefresh) < fiveMinutesAgo || hasNoFitnessData;
      
      if (shouldForceRefresh) {
        console.log('🔄 Auto-refreshing user data on Dashboard page load...', {
          hasNoFitnessData,
          timeSinceLastRefresh: lastAutoRefresh ? (now - parseInt(lastAutoRefresh)) / 2 + 's' : 'never'
        });
        autoRefreshUserData(false).then(() => {
          sessionStorage.setItem('fitapp_last_auto_refresh', now.toString());
        });
      } else {
        console.log('🕐 Auto-refresh skipped on Dashboard - synced recently and has fitness data');
      }
    }
  }, [user?.sub, user?.steps, user?.weight, autoRefreshUserData])

  // React Query will automatically refetch when needed
  // The SSE connection will push updates in real-time
  // No need for manual refetch on lastDataRefresh since React Query handles it

  // Check for query parameter to open weight modal (from chat card click)
  useEffect(() => {
    const openWeightModal = searchParams.get('openWeightModal')
    if (openWeightModal === 'true' && activeChallenge && user?.sub) {
      setShowWeightModal(true)
      // Remove query parameter from URL
      searchParams.delete('openWeightModal')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, activeChallenge, user?.sub])

  // Check if today is a weigh-in day (including first weigh-in day for future challenges)
  useEffect(() => {
    if (!activeChallenge || !user?.sub) {
      setShouldPromptForWeight(false)
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Parse startDate (handle both date-only and datetime formats)
    let startDate = null
    if (activeChallenge.startDate) {
      if (activeChallenge.startDate.includes('T')) {
        startDate = new Date(activeChallenge.startDate)
      } else {
        const dateMatch = activeChallenge.startDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          startDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
        } else {
          startDate = new Date(activeChallenge.startDate)
        }
      }
      startDate.setHours(0, 0, 0, 0)
    }
    
    // Parse endDate (handle both date-only and datetime formats)
    let endDate = null
    if (activeChallenge.endDate) {
      if (activeChallenge.endDate.includes('T')) {
        endDate = new Date(activeChallenge.endDate)
      } else {
        const dateMatch = activeChallenge.endDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          endDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
        } else {
          endDate = new Date(activeChallenge.endDate)
        }
      }
      endDate.setHours(0, 0, 0, 0)
    }

    // Check if challenge has started
    if (startDate && today < startDate) {
      // Challenge hasn't started yet - don't prompt
      setShouldPromptForWeight(false)
      return
    }

    // Check if challenge has ended
    if (endDate && today > endDate) {
      // Challenge has ended - don't prompt
      setShouldPromptForWeight(false)
      return
    }

    // Check if today is the first day of the challenge
    const isFirstDay = startDate && today.getTime() === startDate.getTime()
    
    // Check if today is the weigh-in day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayDayName = dayNames[today.getDay()]
    const isWeighInDay = activeChallenge.weighInDay && 
                        activeChallenge.weighInDay.toLowerCase() === todayDayName

    // For future challenges: only prompt on first weigh-in day (when challenge starts on weigh-in day)
    // For ongoing challenges: prompt on any weigh-in day (not just first day)
    if (isFirstDay && isWeighInDay) {
      // First weigh-in day - show modal (this will set starting weight for future challenges)
      setShouldPromptForWeight(true)
    } else if (isWeighInDay && !isFirstDay) {
      // Regular weigh-in day (not first day) - show modal
      setShouldPromptForWeight(true)
    } else {
      // Not a weigh-in day or first day without weigh-in - don't show
      setShouldPromptForWeight(false)
    }
  }, [activeChallenge, user?.sub])

  // Handle weight submission
  const handleWeightSubmitted = async (newWeight) => {
    // Refresh participant data immediately
    if (activeChallenge?._id && user?.sub) {
      try {
        const apiUrl = getApiUrl()
        
        // Wait a brief moment to ensure backend has saved the data
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const participantResponse = await fetchWithAuth(`${apiUrl}/api/challenge/${activeChallenge._id}/participant/${user.sub}`)
        if (participantResponse.ok) {
          const participant = await participantResponse.json()
          
          // Update participant data state
          setParticipantData(participant.participant)
          
          // Invalidate React Query cache to ensure UI updates
          await queryClient.invalidateQueries({ queryKey: ['challenges', user.sub] })
          await queryClient.invalidateQueries({ queryKey: ['userData', user.sub] })
          
          // Force a re-render by updating a timestamp or trigger
          // The participantData state update above should trigger a re-render
        } else {
          const errorText = await participantResponse.text().catch(() => 'Unknown error')
          console.error('Failed to fetch participant data after weight submission:', errorText)
        }
      } catch (err) {
        console.error('Failed to refresh participant data:', err)
      }
    }
    
    // Update user weight in context
    if (user) {
      // The UserContext will handle updating the user object
      // We can trigger a refresh if needed
    }
  }

  // Handle manual sync button click
  const handleSyncClick = async () => {
    if (isSyncing) return // Prevent multiple simultaneous syncs
    
    setIsSyncing(true)
    setSyncError(null)

    // #region agent log
    debugLog({ location: 'Dashboard.jsx:handleSyncClick', message: 'Sync started', data: { dataSource: user?.dataSource }, hypothesisId: 'B' })
    // #endregion
    
    try {
      // Check user's data source and sync accordingly
      const dataSource = user?.dataSource || 'google-fit'
      let syncData = null // Store sync result to check for errors
      
      if (dataSource === 'fitbit') {
        // For Fitbit, use backend API which handles Fitbit sync
        console.log('🔄 Syncing Fitbit data via backend...')
        const apiUrl = getApiUrl()
        
        // First sync current data
        const response = await fetchWithAuth(`${apiUrl}/api/user/userdata?googleId=${user.sub}`)
        
        if (!response.ok) {
          throw new Error('Failed to sync Fitbit data')
        }
        
        syncData = await response.json()
        // #region agent log
        debugLog({ location: 'Dashboard.jsx:after-Fitbit-sync', message: 'Fitbit sync completed', data: { steps: syncData.steps, weight: syncData.weight }, hypothesisId: 'C' })
        // #endregion
        console.log('✅ Fitbit sync completed successfully', { steps: syncData.steps, weight: syncData.weight })
        
        // Update user context with synced data
        // Only update if we got valid data (not rate limited or error)
        if (!syncData.error && !syncData.warning && (syncData.steps !== undefined || syncData.weight !== undefined)) {
          setUser(prev => ({
            ...prev,
            steps: syncData.steps !== undefined ? syncData.steps : prev?.steps,
            weight: syncData.weight !== undefined ? syncData.weight : prev?.weight,
            lastSync: syncData.lastSync ? new Date(syncData.lastSync) : new Date(),
            dataSource: syncData.dataSource || prev?.dataSource
          }))
        } else if (syncData.warning || syncData.error) {
          // If rate limited or error, only update if the returned data is better than what we have
          // (i.e., if we have 0 steps but returned data has steps, use it)
          setUser(prev => {
            const shouldUpdate = 
              (syncData.steps !== undefined && syncData.steps > 0 && (!prev?.steps || prev.steps === 0)) ||
              (syncData.weight !== undefined && syncData.weight !== null && (!prev?.weight || prev.weight === null));
            
            if (shouldUpdate) {
              return {
                ...prev,
                steps: syncData.steps !== undefined && syncData.steps > 0 ? syncData.steps : prev?.steps,
                weight: syncData.weight !== undefined && syncData.weight !== null ? syncData.weight : prev?.weight,
                lastSync: syncData.lastSync ? new Date(syncData.lastSync) : prev?.lastSync,
                dataSource: syncData.dataSource || prev?.dataSource
              }
            }
            return prev; // Don't overwrite good data with stale data
          })
        }
        
        // Don't trigger historical sync if we got rate limited - it will just fail
        if (!syncData.error && !syncData.warning) {
          // Trigger a historical sync for the last 30 days to populate StepsHistory
          // This is done by calling the endpoint again with a longer range
          // The backend will sync historical data when fetching
          console.log('🔄 Syncing Fitbit historical data (last 30 days)...')
          // The backend already syncs last 7 days on each call, but we can trigger
          // additional syncs by calling the endpoint - the syncFitbitHistory function
          // will handle the date range. For now, the 7-day sync should be sufficient
          // as StepsHistory will fetch from the database which has the stored data.
        } else {
          console.log('⚠️ Skipping historical sync due to rate limit or error')
        }
      } else {
        // For Google Fit, use existing sync function
        await syncGoogleFitData()
        // #region agent log
        debugLog({ location: 'Dashboard.jsx:after-syncGoogleFitData', message: 'Google Fit sync completed', data: {}, hypothesisId: 'C' })
        // #endregion
        console.log('✅ Google Fit sync completed successfully')
      }
      
      // Only invalidate cache if sync was successful (no error/warning)
      // This prevents overwriting good data with stale cached data
      if (user?.sub) {
        // Small delay to ensure state updates are complete
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Only refetch if we didn't get an error/warning
        const currentUser = user || JSON.parse(localStorage.getItem('fitapp_user') || '{}')
        const shouldRefetch = currentUser?.dataSource !== 'fitbit' || (!syncData?.error && !syncData?.warning)
        
        if (shouldRefetch) {
          await queryClient.invalidateQueries({ queryKey: ['userData', user.sub] })
          await queryClient.refetchQueries({ queryKey: ['userData', user.sub] })
          console.log('🔄 React Query cache invalidated and refetched')
        } else {
          console.log('⏭️ Skipping cache refetch to preserve good data')
        }
      }
      
      // Wait a moment for state to update, then check if weight is null after sync
      // If so, use most recent weight from FitnessHistory
      await new Promise(resolve => setTimeout(resolve, 500)) // Small delay to allow state updates
      
      // Check user from context (which should be updated by syncGoogleFitData)
      const currentUser = user || JSON.parse(localStorage.getItem('fitapp_user') || '{}')
      if (!currentUser?.weight || currentUser.weight === null) {
        console.log('⚠️ No weight from Google Fit, fetching most recent weight from history...')
        
        try {
          const apiUrl = getApiUrl()
          const historyResponse = await fetchWithAuth(`${apiUrl}/api/user/fitness-history/${user.sub}?limit=30`)
          
          if (historyResponse.ok) {
            const history = await historyResponse.json()
            const mostRecentWeightEntry = history.find(entry => entry.weight !== null && entry.weight !== undefined)
            
            if (mostRecentWeightEntry && mostRecentWeightEntry.weight) {
              console.log(`📊 Using most recent weight from history: ${mostRecentWeightEntry.weight} lbs`)
              
              // Save to backend and update user state
              const saveResponse = await fetchWithAuth(`${apiUrl}/api/user/userdata`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  googleId: user.sub,
                  name: user.name,
                  email: user.email,
                  picture: user.picture,
                  steps: currentUser.steps || 0,
                  weight: mostRecentWeightEntry.weight,
                  challengeIds: activeChallenge?._id ? [activeChallenge._id] : []
                })
              })
              
              if (saveResponse.ok) {
                console.log('✅ Updated user with most recent weight from history')
                // Update user state in context
                setUser(prev => ({
                  ...prev,
                  weight: mostRecentWeightEntry.weight,
                  lastSync: new Date()
                }))
              }
            } else {
              console.log('⚠️ No weight found in fitness history')
            }
          }
        } catch (historyError) {
          console.error('❌ Failed to fetch fitness history:', historyError)
          // Don't throw - the sync was successful, just couldn't get history
        }
      }
      
      // Refresh participant data after sync
      if (activeChallenge?._id && user?.sub) {
        try {
          const apiUrl = getApiUrl()
          const participantResponse = await fetchWithAuth(`${apiUrl}/api/challenge/${activeChallenge._id}/participant/${user.sub}`)
          if (participantResponse.ok) {
            const participant = await participantResponse.json()
            // #region agent log
            debugLog({ location: 'Dashboard.jsx:participant-after-sync', message: 'Participant data after sync', data: { stepGoalPoints: participant.participant?.stepGoalPoints, points: participant.participant?.points }, hypothesisId: 'D' })
            // #endregion
            setParticipantData(participant.participant)
          }
        } catch (err) {
          console.error('Failed to refresh participant data after sync:', err)
        }
      }
    } catch (error) {
      console.error('❌ Sync failed:', error)
      const dataSource = user?.dataSource || 'google-fit'
      const sourceName = dataSource === 'fitbit' ? 'Fitbit' : 'Google Fit'
      setSyncError(error.message || `Failed to sync with ${sourceName}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Safety check for user object
  if (!user) {
    return (
      <div className="w-full bg-gray-50 min-h-screen relative">
        <main className="px-0 py-6 pb-24 safe-area-content">
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    )
  }

  // Prefer React Query data - only fallback to user if userData is truly null (not just loading)
  // This prevents flickering between userData and user during loading
  const currentUserData = userData !== undefined ? userData : user
  // Changed condition: only require steps OR weight (not both) to hide the message
  // Steps are more critical, so if we have steps, we have fitness data
  const hasFitnessData = (currentUserData?.steps !== null && currentUserData?.steps !== undefined) || (currentUserData?.weight !== null && currentUserData?.weight !== undefined)
  
  // Determine if all card data is ready to display
  // Wait for initial load of userData and challengesData from React Query
  // Also wait for participant data if in a challenge, and weight data to be determined
  // React Query will handle caching - showing old data while fetching new data
  const hasUserData = !userDataLoading && (userData !== undefined || user !== null)
  const hasChallengesData = !challengesLoading && (challengesData !== undefined)
  
  // If in a challenge, we need participantData fetch to complete
  // If not in a challenge, we just need hasInitialDataLoaded (rank fetch completed)
  const hasChallengeData = activeChallenge 
    ? (!isLoadingParticipantData && hasInitialDataLoaded) // In challenge: wait for participantData fetch to complete
    : hasInitialDataLoaded // No challenge: just need rank fetch to complete
  
  // Weight data: need to wait for mostRecentWeight fetch if no weight in userData
  // If we have weight in userData or participantData, we're good
  // Otherwise, wait for weight fetch to complete (not just hasInitialDataLoaded)
  const hasWeightData = currentUserData?.weight !== null && currentUserData?.weight !== undefined
    ? true // Have weight from userData
    : participantData?.lastWeight !== null && participantData?.lastWeight !== undefined
    ? true // Have weight from participantData
    : !isLoadingWeight && hasInitialDataLoaded // Wait for mostRecentWeight fetch to complete
  
  // Calculate if cards are ready - use one-way gate: once true, stay true
  const cardsReadyThisRender = hasUserData && hasChallengesData && hasChallengeData && hasWeightData && hasInitialDataLoaded
  if (cardsReadyThisRender) {
    hasEverBeenReadyRef.current = true
  }
  const allCardsDataReady = hasEverBeenReadyRef.current || cardsReadyThisRender



  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="w-full bg-gray-50 min-h-screen relative">
        {/* Main content with bottom navigation offset and top padding for fixed header */}
        <main className="px-0 py-6 pb-24 safe-area-content">
        
        {/* Show loading spinner at center if initial data hasn't loaded yet */}
        {!allCardsDataReady && (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Main Dashboard Content - Only show when data is ready */}
        {allCardsDataReady && (
          <div className="space-y-2">
            {/* Subtle loading indicator when fetching in background - above User Card */}
            {(userDataFetching || challengesFetching) && (userData || challengesData) && (
              <div className="flex items-center justify-center py-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* User Card at Top */}
            <UserCard
              name={user.name}
              picture={user.picture}
              message="Let's check your activity"
              onClick={() => console.log('User card clicked')}
            />

            {/* Challenge Ranking Card - Only show if we have data or have confirmed no data */}
            {activeChallenge && (userRank !== null || hasInitialDataLoaded) && (
              <StatCard
                variant="deep"
                title="Challenge Ranking"
                value={userRank?.rank ? `#${userRank.rank}` : 'N/A'}
                subtitle={activeChallenge.name}
                iconType="rank"
                onClick={() => {
                  window.location.href = '/leaderboard'
                }}
              />
            )}
            {!activeChallenge && (
              <StatCard
                variant="deep"
                title="Join or create a challenge to start competing!"
                value=""
                subtitle=""
                iconType="rank"
                onClick={() => {
                  window.location.href = '/challenges'
                }}
              />
            )}

            {/* Steps Card - Show progress card when in challenge, stat card when not */}
            {hasFitnessData && (() => {
              const currentSteps = currentUserData.steps ?? 0;
              
              // If in a challenge, show progress card with goal
              if (activeChallenge?.stepGoal) {
                const stepGoal = activeChallenge.stepGoal;
                const { achieved } = getStepProgress(stepGoal);
                return (
                  <ProgressCard
                    title="Step Goal Progress"
                    current={currentSteps}
                    goal={stepGoal}
                    achieved={achieved}
                    showPointStatus={true}
                    onClick={() => navigate('/steps-history')}
                  />
                );
              }
              
              // If not in a challenge, show simple stat card with just current steps
              return (
                <StatCard
                  variant="primary"
                  title="Current Steps"
                  value={currentSteps.toLocaleString()}
                  subtitle="Steps Today"
                  iconType="steps"
                  onClick={() => navigate('/steps-history')}
                />
              );
            })()}

            {/* Confirm Weight Button - Only on weigh-in day */}
            {shouldPromptForWeight && activeChallenge && (
              <button
                onClick={() => setShowWeightModal(true)}
                className="w-full flex items-center justify-center space-x-2 p-4 rounded-xl font-semibold transition-all bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md"
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Confirm Weight</span>
              </button>
            )}

            {/* Weight Card - Only show if we have data or have confirmed no data after initial load */}
            {hasInitialDataLoaded && (
              <StatCard
                variant="light"
                title="Current Weight"
              value={(() => {
                // On weigh-in day: prefer the value submitted via Confirm Weight (participantData.lastWeight)
                // Otherwise: use most recent weight synced from preferred data source (Google Fit/Fitbit)
                const isWeighInDay = !!(shouldPromptForWeight && activeChallenge);
                const weightToShow = isWeighInDay
                  ? (participantData?.lastWeight ?? currentUserData?.weight ?? mostRecentWeight)
                  : (currentUserData?.weight ?? mostRecentWeight);
                return weightToShow !== null && weightToShow !== undefined
                  ? `${weightToShow.toFixed(1)} lbs`
                  : 'N/A';
              })()}
              subtitle={(() => {
                if (!activeChallenge) {
                  // Not in a challenge - show most recent weight source
                  return mostRecentWeight && !currentUserData?.weight
                    ? 'Most recent weight'
                    : '';
                }
                
                // In a challenge - check if challenge has started
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let startDate = null;
                if (activeChallenge.startDate) {
                  if (activeChallenge.startDate.includes('T')) {
                    startDate = new Date(activeChallenge.startDate);
                  } else {
                    const dateMatch = activeChallenge.startDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (dateMatch) {
                      startDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                    } else {
                      startDate = new Date(activeChallenge.startDate);
                    }
                  }
                  startDate.setHours(0, 0, 0, 0);
                }
                
                const challengeHasStarted = startDate && today >= startDate;
                
                // Check if first weigh-in day has passed
                let firstWeighInDayHasPassed = false;
                if (challengeHasStarted && activeChallenge.weighInDay) {
                  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const firstWeighInDay = new Date(startDate);
                  const startDayName = dayNames[firstWeighInDay.getDay()];
                  const weighInDayIndex = dayNames.indexOf(activeChallenge.weighInDay.toLowerCase());
                  const startDayIndex = dayNames.indexOf(startDayName);
                  
                  let daysUntilWeighIn = (weighInDayIndex - startDayIndex + 7) % 7;
                  if (daysUntilWeighIn === 0 && startDayName === activeChallenge.weighInDay.toLowerCase()) {
                    daysUntilWeighIn = 0;
                  }
                  
                  firstWeighInDay.setDate(firstWeighInDay.getDate() + daysUntilWeighIn);
                  firstWeighInDay.setHours(0, 0, 0, 0);
                  firstWeighInDayHasPassed = today >= firstWeighInDay;
                }
                
                // Only show starting weight if:
                // 1. Challenge has started
                // 2. First weigh-in day has passed (or is today)
                // 3. Starting weight has been confirmed (not null)
                if (challengeHasStarted && firstWeighInDayHasPassed && participantData?.startingWeight) {
                  return `Started: ${participantData.startingWeight} lbs`;
                } else {
                  // Don't show starting weight if challenge hasn't started, first weigh-in day hasn't passed, or weight hasn't been confirmed
                  return '';
                }
              })()}
              iconType="weight"
              onClick={() => navigate('/weight-history')}
              />
            )}

          {/* Status indicator */}
          {!hasFitnessData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-yellow-600">
                  <svg width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800">Setting up fitness data sync...</h3>
                  <p className="text-yellow-700">We're working on connecting to your fitness data. This may take a moment for new accounts.</p>
                </div>
              </div>
            </div>
          )}



          {/* Recent Activity */}
          <div className="mb-6">
            <h3 className={unifiedDesignSystem.typography.hierarchy.sectionTitle + " text-blue-900 mb-4"}>
              Recent Activity
            </h3>
            <div className="space-y-3">
              {/* Sync Button */}
              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className={`w-full flex items-center justify-center space-x-2 p-4 rounded-xl font-semibold transition-all ${
                  isSyncing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                } text-white shadow-md`}
              >
                {isSyncing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sync Data</span>
                  </>
                )}
              </button>

              {/* Sync Error Message */}
              {syncError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="text-red-600">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 text-sm">{syncError}</span>
                  </div>
                </div>
              )}

              {/* Sync Status */}
              <div className="flex items-center justify-between p-4 bg-blue-500 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  <span className="text-white">Fitness data synced successfully</span>
                </div>
                <span className="text-sm text-white opacity-80">
                  {currentUserData.lastSync ? new Date(currentUserData.lastSync).toLocaleTimeString() : '—'}
                </span>
              </div>

            </div>
          </div>
          </div>
        )}
      </main>
    </div>

    {/* Weight Input Modal */}
    {activeChallenge && (
      <WeightInputModal
        isOpen={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        challenge={activeChallenge}
        onWeightSubmitted={handleWeightSubmitted}
        user={user}
      />
    )}
    </>
  )
}

export default Dashboard
