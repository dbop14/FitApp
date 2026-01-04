import { useState, useEffect, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import ChallengeForm from '../components/ChallengeForm'
import ChallengeInfoModal from '../components/ChallengeInfoModal'
import Button from '../components/ui/Button'
import StackedAvatars from '../components/ui/StackedAvatars'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import { useChallenges } from '../hooks/useChallenges'

/**
 * Challenge Page - Shows active and completed challenges
 * 
 * Features:
 * - Active challenges at the top with current status
 * - Completed challenges at the bottom for historical view
 * - Challenge cards similar to settings page design
 * - Navigation to leaderboard when clicking active challenge
 */

const Challenge = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { challenge: activeChallenge, saveChallenge, clearChallenge } = useChallenge()
  const { user, lastDataRefresh, autoRefreshUserData } = useContext(UserContext)
  const [showForm, setShowForm] = useState(false)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false)
  const [showStartingWeightModal, setShowStartingWeightModal] = useState(false)
  const [challengeCode, setChallengeCode] = useState('')
  const [startingWeight, setStartingWeight] = useState('')
  const [validatedChallenge, setValidatedChallenge] = useState(null)
  const [jwtToken, setJwtToken] = useState(localStorage.getItem('fitapp_jwt_token'))
  const [showCompletedChallengeModal, setShowCompletedChallengeModal] = useState(false)
  const [selectedCompletedChallenge, setSelectedCompletedChallenge] = useState(null)
  const [completedChallengeRankings, setCompletedChallengeRankings] = useState([])
  
  // Use React Query hook for challenges with caching
  const { data: challengesData, isLoading: challengesLoading, isFetching: challengesFetching } = useChallenges()
  
  // Process challenges data - separate active and completed
  const { userChallenges, completedChallenges } = (() => {
    if (!challengesData || challengesData.length === 0) {
      return { userChallenges: [], completedChallenges: [] }
    }
    
    const now = new Date()
    const parseLocalDate = (dateString) => {
      if (!dateString) return null
      // If the string contains 'T' (datetime format), parse it directly as ISO datetime
      if (dateString.includes('T')) {
        return new Date(dateString)
      }
      // For date-only strings (YYYY-MM-DD), parse as local midnight
      const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateMatch) {
        return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
      }
      // Fallback to standard Date parsing
      return new Date(dateString)
    }
    
    const active = challengesData.filter(challenge => {
      if (!challenge || challenge._deleted) return false
      if (!challenge.endDate) {
        return true
      }
      const endDate = parseLocalDate(challenge.endDate)
      // For date-only strings, use end of day (23:59:59.999) for comparison
      const isDateOnly = !challenge.endDate.includes('T')
      const endOfDay = isDateOnly ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999) : endDate
      return endOfDay >= now
    })
    
    const completed = challengesData.filter(challenge => {
      if (!challenge || challenge._deleted || !challenge.endDate) return false
      const endDate = parseLocalDate(challenge.endDate)
      // For date-only strings, use end of day (23:59:59.999) for comparison
      const isDateOnly = !challenge.endDate.includes('T')
      const endOfDay = isDateOnly ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999) : endDate
      return endOfDay < now
    })
    
    return { userChallenges: active, completedChallenges: completed }
  })()
  
  // Only show loading if we have no cached data
  const loading = challengesLoading && !challengesData

  // Design system tokens
  const { components, spacing, layout } = unifiedDesignSystem

  // Check if JWT token is expired
  const isJWTTokenExpired = () => {
    const jwtExpiry = localStorage.getItem('fitapp_jwt_expiry')
    if (!jwtExpiry) return true
    return Date.now() > parseInt(jwtExpiry, 10)
  }
  
  // Refetch challenges function (uses React Query)
  const refetchChallenges = () => {
    if (user?.sub) {
      queryClient.invalidateQueries({ queryKey: ['challenges', user.sub] })
      // Also invalidate all participant queries to refresh profile pictures
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    }
  }

  // Fetch participants for all challenges using React Query with caching
  const allChallenges = useMemo(() => [...userChallenges, ...completedChallenges], [userChallenges, completedChallenges])
  
  const participantQueries = useQueries({
    queries: allChallenges.map((challenge) => ({
      queryKey: ['leaderboard', challenge._id, user?.sub],
      queryFn: async () => {
        if (!challenge._id || !user?.sub) {
          return []
        }
        
        const apiUrl = getApiUrl()
        
        // First, update participant data (silently fail if it doesn't work)
        await fetch(`${apiUrl}/api/update-participant/${challenge._id}/${user.sub}`, {
          method: 'POST'
        }).catch(() => {})
        
        // Then fetch leaderboard
        const response = await fetchWithAuth(`${apiUrl}/api/leaderboard/${challenge._id}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.status}`)
        }
        
        return await response.json()
      },
      enabled: !!challenge._id && !!user?.sub && !!challengesData,
      staleTime: 2 * 60 * 1000, // 2 minutes - cache participant data
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Use cache if data is fresh
      retry: 1,
    }))
  })
  
  // Transform participant queries into a map for easy access
  const challengeParticipants = useMemo(() => {
    const participantsMap = {}
    allChallenges.forEach((challenge, index) => {
      const query = participantQueries[index]
      if (query?.data) {
        participantsMap[challenge._id] = query.data
      }
    })
    return participantsMap
  }, [allChallenges, participantQueries])
  
  // Validate active challenge and set default if needed
  useEffect(() => {
    if (!challengesData) return
    
    // Validate that the active challenge still exists and is not deleted
    if (activeChallenge?._id) {
      const allChallenges = [...userChallenges, ...completedChallenges]
      const challengeStillExists = allChallenges.some(c => c._id === activeChallenge._id)
      
      if (!challengeStillExists) {
        console.log('🗑️ Active challenge has been deleted, clearing from context')
        clearChallenge()
      }
    }
    
    // If no active challenge in context but we have active challenges, load the first one
    if (!activeChallenge && userChallenges.length > 0) {
      const sortedActive = [...userChallenges].sort((a, b) => {
        if (!a.endDate && !b.endDate) {
          return a._id.localeCompare(b._id)
        }
        if (!a.endDate) return -1
        if (!b.endDate) return 1
        const dateDiff = new Date(b.endDate) - new Date(a.endDate)
        if (dateDiff !== 0) return dateDiff
        return a._id.localeCompare(b._id)
      })
      saveChallenge(sortedActive[0])
    }
  }, [challengesData, userChallenges, completedChallenges, activeChallenge, clearChallenge, saveChallenge])

  // Listen for JWT token changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'fitapp_jwt_token') {
        setJwtToken(e.newValue)
        console.log('🔄 JWT token updated in Challenge component')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Also check for changes in the current tab
    const checkToken = () => {
      const currentToken = localStorage.getItem('fitapp_jwt_token')
      if (currentToken !== jwtToken) {
        setJwtToken(currentToken)
        console.log('🔄 JWT token changed in current tab')
      }
    }

    const interval = setInterval(checkToken, 1000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [jwtToken])

  // Auto-refresh user data when page loads
  useEffect(() => {
    if (user?.sub && autoRefreshUserData) {
      const lastAutoRefresh = sessionStorage.getItem('fitapp_last_auto_refresh')
      const now = Date.now()
      const fiveMinutesAgo = now - (5 * 60 * 1000)
      
      if (!lastAutoRefresh || parseInt(lastAutoRefresh) < fiveMinutesAgo) {
        console.log('🔄 Auto-refreshing user data on Challenge page load...')
        autoRefreshUserData(false).then(() => {
          sessionStorage.setItem('fitapp_last_auto_refresh', now.toString())
        })
      }
    }
  }, [user?.sub, autoRefreshUserData])

  const handleJoinWithCode = () => {
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot join with code')
      alert('Please log in to join challenges.')
      return
    }

    setShowJoinCodeModal(true)
  }

  const handleJoinCodeSubmit = async () => {
    if (!challengeCode.trim()) return
    
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot join challenge with code')
      alert('Please log in to join challenges.')
      return
    }

    try {
      // First, validate the challenge code
      const response = await fetchWithAuth(`${getApiUrl()}/api/challenge/code/${challengeCode.trim()}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Challenge lookup failed:', errorText)
        alert('Challenge not found. Please check the code and try again.')
        return
      }
      
      const challenge = await response.json()
      console.log('✅ Found challenge:', challenge)
      
      // Check if challenge starts in the future
      const parseLocalDate = (dateString) => {
        if (!dateString) return null
        // Handle ISO datetime format (YYYY-MM-DDTHH:mm:ss)
        if (dateString.includes('T')) {
          return new Date(dateString)
        }
        const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
        }
        return new Date(dateString)
      }
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const challengeStart = challenge.startDate ? parseLocalDate(challenge.startDate) : null
      const isFutureChallenge = challengeStart && challengeStart > today
      
      if (isFutureChallenge) {
        // For future challenges, join without starting weight
        // The weight will be set on the first weigh-in day
        try {
          const participantResponse = await fetchWithAuth(`${getApiUrl()}/api/leaderboard/${challenge._id}/participants`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.sub,
              email: user.email,
              name: user.name,
              picture: user.picture,
              startingWeight: null // Will be set on first weigh-in day
            })
          })
          
          if (participantResponse.ok) {
            console.log('✅ Successfully joined future challenge')
            saveChallenge(challenge)
            await new Promise(resolve => setTimeout(resolve, 500))
            
            if (user?.sub) {
              await queryClient.invalidateQueries({ queryKey: ['challenges', user.sub] })
              console.log('✅ Invalidated challenges cache')
            }
            
            refetchChallenges()
            setChallengeCode('')
            setShowJoinCodeModal(false)
            setValidatedChallenge(null)
            alert('Successfully joined the challenge! Your starting weight will be set on the first weigh-in day.')
          } else {
            const errorData = await participantResponse.json().catch(() => ({ error: 'Unknown error' }))
            if (errorData.error === 'User is already a participant in this challenge') {
              alert('You are already a participant in this challenge.')
              saveChallenge(challenge)
              setChallengeCode('')
              setShowJoinCodeModal(false)
              setValidatedChallenge(null)
              refetchChallenges()
            } else {
              throw new Error(errorData.error || 'Failed to join challenge')
            }
          }
        } catch (err) {
          console.error('❌ Error joining future challenge:', err)
          alert(`Failed to join challenge: ${err.message || 'Please try again.'}`)
        }
      } else {
        // For current/past challenges, show starting weight modal
        setValidatedChallenge(challenge)
        setShowJoinCodeModal(false)
        setShowStartingWeightModal(true)
      }
    } catch (err) {
      console.error('❌ Error validating challenge code:', err)
      alert(`Failed to validate challenge code: ${err.message || 'Please try again.'}`)
    }
  }

  const handleJoinCodeCancel = () => {
    setShowJoinCodeModal(false)
    setChallengeCode('')
    setValidatedChallenge(null)
  }

  const handleStartingWeightSubmit = async () => {
    if (!validatedChallenge) {
      alert('No challenge selected. Please try again.')
      return
    }

    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot join challenge')
      alert('Please log in to join challenges.')
      return
    }

    // Validate starting weight
    const weight = parseFloat(startingWeight)
    if (!startingWeight.trim() || isNaN(weight) || weight <= 0) {
      alert('Please enter a valid starting weight.')
      return
    }

    try {
      // Join the challenge using the leaderboard participants endpoint
      const participantResponse = await fetchWithAuth(`${getApiUrl()}/api/leaderboard/${validatedChallenge._id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.sub,
          email: user.email,
          name: user.name,
          picture: user.picture,
          startingWeight: weight
        })
      })
      
      if (participantResponse.ok) {
        console.log('✅ Successfully joined challenge')
        
        // Save challenge to context immediately so it's available
        saveChallenge(validatedChallenge)
        
        // Small delay to ensure backend has processed the participant record
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Invalidate React Query cache to force refresh of challenges
        if (user?.sub) {
          await queryClient.invalidateQueries({ queryKey: ['challenges', user.sub] })
          console.log('✅ Invalidated challenges cache')
        }
        
        // Refresh challenge list to ensure it appears (force refresh)
        refetchChallenges()
        
        setChallengeCode('')
        setStartingWeight('')
        setShowStartingWeightModal(false)
        setValidatedChallenge(null)
        alert('Successfully joined the challenge!')
      } else {
        const errorData = await participantResponse.json().catch(() => ({ error: 'Unknown error' }))
        if (errorData.error === 'User is already a participant in this challenge') {
          alert('You are already a participant in this challenge.')
          // Save challenge to context even if already a participant
          saveChallenge(validatedChallenge)
          setChallengeCode('')
          setStartingWeight('')
          setShowStartingWeightModal(false)
          setValidatedChallenge(null)
          refetchChallenges()
        } else {
          throw new Error(errorData.error || 'Failed to join challenge')
        }
      }
    } catch (err) {
      console.error('❌ Error joining challenge:', err)
      alert(`Failed to join challenge: ${err.message || 'Please try again.'}`)
    }
  }

  const handleStartingWeightCancel = () => {
    setShowStartingWeightModal(false)
    setStartingWeight('')
    setValidatedChallenge(null)
    setShowJoinCodeModal(true)
  }

  const handleCreateChallenge = (challengeData) => {
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot create challenge')
      alert('Please log in to create challenges.')
      return
    }

    console.log('🚀 Creating new challenge:', challengeData)
    
    // Validate the challenge data
    if (!challengeData || !challengeData._id) {
      console.error('❌ Invalid challenge data received:', challengeData)
      alert('Invalid challenge data received. Please try again.')
      return
    }
    
    // Clear any existing challenge data first
    clearChallenge()
    
    // Clear any challenge clearing flags since we're creating a new one
    sessionStorage.removeItem('fitapp_challenge_cleared')
    
    // Save the new challenge
    saveChallenge(challengeData)
    setShowForm(false)
    
    // Show success message
    alert(`Challenge "${challengeData.name}" created successfully!`)
    
    // Refresh the challenges list
    refetchChallenges()
    
    console.log('✅ New challenge created and saved')
  }

  const handleClearAndCreateNew = () => {
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot create new challenge')
      alert('Please log in to create challenges.')
      return
    }

    clearChallenge()
    setShowForm(true)
  }

  const handleChallengeUpdate = (updatedChallenge) => {
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot update challenge')
      alert('Please log in to update challenges.')
      return
    }

    // Check if this is a delete request
    if (updatedChallenge._delete) {
      console.log('🗑️ Challenge deletion requested, clearing context')
      clearChallenge()
      setShowManagerModal(false)
      // Set flag to prevent auto-reloading of challenges
      sessionStorage.removeItem('fitapp_challenge_cleared')
      console.log('🚫 Set flag to prevent auto-challenge reload')
      // Refresh the challenges list
      refetchChallenges()
      return
    }
    
    // Regular challenge update
    saveChallenge(updatedChallenge)
    setShowManagerModal(false)
    // Refresh the challenges list
    refetchChallenges()
  }

  const handleChallengeCardClick = async (challenge) => {
    // Check if JWT token is valid before proceeding
    if (!jwtToken || isJWTTokenExpired()) {
      console.log('🔒 JWT token not valid, cannot view challenge details')
      return
    }

    // Parse endDate - handle both date-only and datetime strings
    const parseLocalDate = (dateString) => {
      if (!dateString) return null
      // If the string contains 'T' (datetime format), parse it directly as ISO datetime
      if (dateString.includes('T')) {
        return new Date(dateString)
      }
      // For date-only strings (YYYY-MM-DD), parse as local midnight
      const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateMatch) {
        return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
      }
      // Fallback to standard Date parsing
      return new Date(dateString)
    }
    if (challenge.endDate && parseLocalDate(challenge.endDate) < new Date()) {
      // Completed challenge - show details in modal
      console.log('📊 Viewing completed challenge:', challenge.name)
      setSelectedCompletedChallenge(challenge)
      setShowCompletedChallengeModal(true)
      
      // Fetch final rankings for the completed challenge
      try {
        const response = await fetchWithAuth(`${getApiUrl()}/api/leaderboard/${challenge._id}`)
        if (response.ok) {
          const rankings = await response.json()
          console.log('📊 Completed challenge rankings:', rankings)
          // Sort by rank (1st, 2nd, 3rd, etc.)
          const sortedRankings = rankings.sort((a, b) => (a.rank || 0) - (b.rank || 0))
          setCompletedChallengeRankings(sortedRankings)
        }
      } catch (err) {
        console.error('❌ Error fetching completed challenge rankings:', err)
        setCompletedChallengeRankings([])
      }
    } else {
      // Active challenge - navigate to leaderboard
      saveChallenge(challenge)
      navigate('/leaderboard')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set'
    // Parse date string as local date to avoid timezone issues
    // If dateString is in YYYY-MM-DD format, parse it as local midnight
    const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    let date
    if (dateMatch) {
      // Create date in local timezone (not UTC)
      date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
    } else {
      date = new Date(dateString)
    }
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getChallengeStatus = (challenge) => {
    if (!challenge.endDate) return 'Ongoing'
    // Parse endDate - handle both date-only and datetime strings
    const parseLocalDate = (dateString) => {
      if (!dateString) return null
      // If the string contains 'T' (datetime format), parse it directly as ISO datetime
      if (dateString.includes('T')) {
        return new Date(dateString)
      }
      // For date-only strings (YYYY-MM-DD), parse as local midnight
      const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateMatch) {
        return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
      }
      // Fallback to standard Date parsing
      return new Date(dateString)
    }
    const endDate = parseLocalDate(challenge.endDate)
    const now = new Date()
    
    if (endDate < now) {
      return 'Completed'
    } else if (endDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return 'Ending Soon'
    } else {
      return 'Active'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-50'
      case 'Ending Soon': return 'text-orange-600 bg-orange-50'
      case 'Completed': return 'text-gray-600 bg-gray-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  // Calculate weight loss percentage for the current user
  const getWeightLossPercentage = (challengeId) => {
    const participants = challengeParticipants[challengeId] || []
    const currentUserParticipant = participants.find(p => p.userId === user?.sub)
    
    if (!currentUserParticipant || !currentUserParticipant.startingWeight || !currentUserParticipant.lastWeight) {
      return 0
    }
    
    const weightLost = currentUserParticipant.startingWeight - currentUserParticipant.lastWeight
    const percentage = (weightLost / currentUserParticipant.startingWeight) * 100
    return Math.max(0, Math.round(percentage))
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 pt-20">
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 pt-20">
          {/* Page header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-blue-600 mb-2 leading-tight">
              Challenges
            </h1>
            <p className="text-gray-600">
              Manage your active challenges and view completed ones
            </p>
          </header>

          {/* JWT Token Status */}
          {!jwtToken && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Authentication Required
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>You need to log in to view and manage challenges.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {jwtToken && isJWTTokenExpired() && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Session Expired
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Your login session has expired. Please log in again to continue.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Challenges Section */}
          <section className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Active Challenges</h2>
            </div>

            {userChallenges.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <p className="text-gray-700 text-lg mb-4">
                  {!jwtToken || isJWTTokenExpired() 
                    ? "Please log in to create or join challenges."
                    : "You're not in any active challenges yet."
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!jwtToken || isJWTTokenExpired()) {
                        alert('Please log in to create challenges.')
                        return
                      }
                      setShowForm(true)
                    }}
                    size="md"
                    disabled={!jwtToken || isJWTTokenExpired()}
                  >
                    <span className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Challenge</span>
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleJoinWithCode}
                    size="md"
                    disabled={!jwtToken || isJWTTokenExpired()}
                  >
                    Join with Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {userChallenges.map((challenge) => {
                  const participants = challengeParticipants[challenge._id] || []
                  const weightLossPercentage = getWeightLossPercentage(challenge._id)
                  const status = getChallengeStatus(challenge)
                  
                  return (
                    <div
                      key={challenge._id}
                      onClick={() => {
                        if (!jwtToken || isJWTTokenExpired()) {
                          alert('Please log in to view challenge details.')
                          return
                        }
                        handleChallengeCardClick(challenge)
                      }}
                      className={`bg-white rounded-3xl p-6 shadow-sm border border-gray-100 transition-all duration-200 ${
                        !jwtToken || isJWTTokenExpired()
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:shadow-md hover:border-gray-200'
                      }`}
                    >
                      {/* Header with photo and title */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          {/* Challenge Photo */}
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
                            {challenge.photo ? (
                              <img
                                src={`${getApiUrl()}${challenge.photo}`}
                                alt={challenge.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            {!challenge.photo && (
                              <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="text-blue-600">
                                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1h4a1 1 0 011 1v3z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          
                          {/* Title and status */}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {challenge.name}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                status === 'Completed' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                              }`}>
                                {status === 'Completed' ? 'Challenge ended' : 'Active'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Settings button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!jwtToken || isJWTTokenExpired()) {
                              alert('Please log in to manage challenges.')
                              return
                            }
                            saveChallenge(challenge)
                            setShowManagerModal(true)
                          }}
                          className={`p-2 rounded-full transition-colors ${
                            !jwtToken || isJWTTokenExpired()
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'hover:bg-gray-100 text-gray-500'
                          }`}
                          aria-label="Challenge settings"
                          disabled={!jwtToken || isJWTTokenExpired()}
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                        </button>
                      </div>

                      {/* Stats Section */}
                      <div className="flex items-center justify-between mb-6">
                        {/* Weight Loss */}
                        <div className="flex items-center space-x-3">
                          <div className="bg-orange-100 p-2 rounded-xl">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-orange-600">
                              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-gray-900">
                              {weightLossPercentage > 0 ? `-${weightLossPercentage}%` : '0%'}
                            </div>
                          </div>
                        </div>

                        {/* Dot separator */}
                        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>

                        {/* Participants */}
                        <div className="flex items-center space-x-2">
                          <div className="bg-blue-100 p-2 rounded-xl">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-blue-600">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {participants.length}
                          </div>
                        </div>
                      </div>

                      {/* Members Section */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Members</h4>
                        <StackedAvatars 
                          participants={participants} 
                          size="lg" 
                          maxVisible={4}
                          showCount={false}
                        />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500">
                          Code: {challenge.challengeCode}
                        </div>
                        <div className="text-blue-600 font-medium text-sm hover:text-blue-700 transition-colors">
                          Leaderboard →
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Completed Challenges Button */}
          <section className="mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="text-center">
                <div className="flex justify-center mb-3">
                  <svg className="w-12 h-12 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  View Completed Challenges
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  See your past challenges and final results
                </p>
                <button
                  onClick={() => {
                    if (!jwtToken || isJWTTokenExpired()) {
                      alert('Please log in to view completed challenges.')
                      return
                    }
                    navigate('/completed-challenges')
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                    !jwtToken || isJWTTokenExpired()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={!jwtToken || isJWTTokenExpired()}
                >
                  View Completed Challenges →
                </button>
              </div>
            </div>
          </section>

          {/* Challenge Form Modal */}
          {showForm && jwtToken && !isJWTTokenExpired() && (
            <ChallengeForm 
              onCreate={handleCreateChallenge} 
              onClose={() => setShowForm(false)}
            />
          )}

          {/* Challenge Info Modal */}
          {activeChallenge && jwtToken && !isJWTTokenExpired() && (
            <ChallengeInfoModal 
              isOpen={showManagerModal} 
              onClose={() => setShowManagerModal(false)}
              challenge={activeChallenge}
              onUpdate={handleChallengeUpdate}
            />
          )}

          {/* Join with Code Modal */}
          {showJoinCodeModal && jwtToken && !isJWTTokenExpired() && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4" 
              style={{ alignItems: 'center' }}
              onClick={handleJoinCodeCancel}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 focus:outline-none scroll-smooth"
                style={{ maxHeight: 'calc(75vh - 6rem)', minHeight: '400px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                      <span>Join Challenge with Code</span>
                      <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                    </h2>
                    <button
                      onClick={handleJoinCodeCancel}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Close modal"
                    >
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Enter the challenge code provided by your friend or challenge creator to join their fitness challenge.
                    </p>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Code</label>
                      <input
                        type="text"
                        value={challengeCode}
                        onChange={(e) => setChallengeCode(e.target.value)}
                        placeholder="Enter challenge code..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleJoinCodeSubmit()
                          }
                        }}
                      />
                    </div>

                    <div className="flex space-x-3 mt-6">
                      <button
                        onClick={handleJoinCodeCancel}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                                              <button
                          onClick={handleJoinCodeSubmit}
                          disabled={!challengeCode.trim()}
                          className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
                            challengeCode.trim() 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <span className="flex items-center justify-center space-x-2">
                            <span>Join Challenge</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </span>
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Starting Weight Modal */}
          {showStartingWeightModal && validatedChallenge && jwtToken && !isJWTTokenExpired() && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4" 
              style={{ alignItems: 'center' }}
              onClick={handleStartingWeightCancel}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 focus:outline-none scroll-smooth"
                style={{ maxHeight: 'calc(75vh - 6rem)', minHeight: '300px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                      <span>Enter Your Starting Weight</span>
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                    </h2>
                    <button
                      onClick={handleStartingWeightCancel}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Close modal"
                    >
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800 font-medium mb-1">
                        Challenge: {validatedChallenge.name}
                      </p>
                      <p className="text-xs text-blue-600">
                        This weight will be used to track your progress throughout the challenge.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center space-x-2">
                        <span>Your Starting Weight (lbs)</span>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={startingWeight}
                        onChange={(e) => setStartingWeight(e.target.value)}
                        placeholder="e.g., 154.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleStartingWeightSubmit()
                          }
                        }}
                        autoFocus
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Enter your current weight in pounds. This will be used to track your weight loss progress.
                      </p>
                    </div>

                    <div className="flex space-x-3 mt-6">
                      <button
                        onClick={handleStartingWeightCancel}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md font-semibold transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleStartingWeightSubmit}
                        disabled={!startingWeight.trim() || isNaN(parseFloat(startingWeight)) || parseFloat(startingWeight) <= 0}
                        className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
                          startingWeight.trim() && !isNaN(parseFloat(startingWeight)) && parseFloat(startingWeight) > 0
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <span className="flex items-center justify-center space-x-2">
                          <span>Join Challenge</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completed Challenge Modal */}
          {showCompletedChallengeModal && selectedCompletedChallenge && jwtToken && !isJWTTokenExpired() && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4" 
              style={{ alignItems: 'center' }}
              onClick={() => setShowCompletedChallengeModal(false)}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 focus:outline-none scroll-smooth"
                style={{ maxHeight: 'calc(75vh - 6rem)', minHeight: '400px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                      <span>Completed Challenge</span>
                      <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </h2>
                    <button
                      onClick={() => setShowCompletedChallengeModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Close modal"
                    >
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {selectedCompletedChallenge.name}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {formatDate(selectedCompletedChallenge.startDate)} - {formatDate(selectedCompletedChallenge.endDate)}
                      </p>
                    </div>

                    {completedChallengeRankings.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-3">Final Rankings</h4>
                        <div className="space-y-2">
                          {completedChallengeRankings.map((participant, index) => (
                            <div key={participant.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-bold text-blue-600">
                                  {participant.rank || index + 1}
                                </span>
                                <span className="font-medium text-gray-800">
                                  {(participant.name || 'Unknown User').split(' ')[0]}
                                </span>
                              </div>
                              <span className="text-gray-600 font-semibold">
                                {participant.totalPoints || 0} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => setShowCompletedChallengeModal(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md font-semibold transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export default Challenge
