import { useState, useEffect, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import ChallengeForm from '../components/ChallengeForm'
import ChallengeInfoModal from '../components/ChallengeInfoModal'
import Button from '../components/ui/Button'
import StackedAvatars from '../components/ui/StackedAvatars'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
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

  const authBlocked = !jwtToken || isJWTTokenExpired()
  const startingWeightValid =
    startingWeight.trim() && !isNaN(parseFloat(startingWeight)) && parseFloat(startingWeight) > 0

  const headerActions = !authBlocked && (
    <>
      <button onClick={handleJoinWithCode} className="btn btn-sm btn-on-brand hidden sm:inline-flex">
        <Icon name="users" className="h-4 w-4" />
        Join
      </button>
      <button onClick={() => setShowForm(true)} className="btn btn-sm btn-on-brand hidden sm:inline-flex">
        <Icon name="plus" className="h-4 w-4" />
        Create
      </button>
    </>
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Challenges" />
        <div className="page grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <div className="skeleton h-56" />
          <div className="skeleton h-56" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Challenges" subtitle="Your active and past challenges" actions={headerActions} />

      <div className="page space-y-6">
        {/* Auth status */}
        {!jwtToken && (
          <div className="callout callout-warning">
            <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Authentication required</p>
              <p className="opacity-90">You need to log in to view and manage challenges.</p>
            </div>
          </div>
        )}
        {jwtToken && isJWTTokenExpired() && (
          <div className="callout callout-danger">
            <Icon name="alert-circle" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Session expired</p>
              <p className="opacity-90">Your login session has expired. Please log in again to continue.</p>
            </div>
          </div>
        )}

        {/* Active challenges */}
        <section aria-labelledby="active-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="active-heading" className="section-title">Active challenges</h2>
          </div>

          {userChallenges.length === 0 ? (
            <EmptyState
              icon="trophy"
              title={authBlocked ? 'Log in to get started' : 'No active challenges'}
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (authBlocked) {
                        alert('Please log in to create challenges.')
                        return
                      }
                      setShowForm(true)
                    }}
                    disabled={authBlocked}
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    Create challenge
                  </Button>
                  <Button variant="secondary" onClick={handleJoinWithCode} disabled={authBlocked}>
                    <Icon name="users" className="h-4 w-4" />
                    Join with code
                  </Button>
                </div>
              }
            >
              {authBlocked
                ? 'Please log in to create or join challenges.'
                : 'Create a challenge for your group, or join one with a code from a friend.'}
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {userChallenges.map((challenge) => {
                const participants = challengeParticipants[challenge._id] || []
                const weightLossPercentage = getWeightLossPercentage(challenge._id)
                const status = getChallengeStatus(challenge)
                const open = () => {
                  if (authBlocked) {
                    alert('Please log in to view challenge details.')
                    return
                  }
                  handleChallengeCardClick(challenge)
                }

                return (
                  <article
                    key={challenge._id}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        open()
                      }
                    }}
                    tabIndex={authBlocked ? -1 : 0}
                    role="button"
                    aria-label={`Open ${challenge.name} leaderboard`}
                    className={`card flex flex-col overflow-hidden ${
                      authBlocked ? 'cursor-not-allowed opacity-60' : 'card-interactive cursor-pointer'
                    }`}
                  >
                    {/* Cover */}
                    <div className="relative h-24 bg-gradient-to-br from-blue-500 to-blue-800">
                      {challenge.photo && (
                        <img
                          src={`${getApiUrl()}${challenge.photo}`}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        <span className={`chip ${status === 'Completed' ? 'chip-neutral' : status === 'Ending Soon' ? 'chip-warning' : 'chip-success'}`}>
                          {status === 'Completed' ? 'Ended' : status === 'Ending Soon' ? 'Ending soon' : 'Active'}
                        </span>
                        {challenge.scoringMode === 'v2' && <span className="chip bg-[rgb(255_255_255/0.88)] text-[#1e40af]">Points v2</span>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (authBlocked) {
                            alert('Please log in to manage challenges.')
                            return
                          }
                          saveChallenge(challenge)
                          setShowManagerModal(true)
                        }}
                        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl bg-black/30 text-white backdrop-blur hover:bg-black/45 disabled:cursor-not-allowed"
                        aria-label={`${challenge.name} info and settings`}
                        disabled={authBlocked}
                      >
                        <Icon name="more-horizontal" className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="truncate text-lg font-semibold text-ink">{challenge.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                          <Icon name="trending-down" className="h-4 w-4 text-accent-ink" />
                          <div>
                            <p className="text-[11px] text-ink-muted">Your weight loss</p>
                            <p className="text-sm font-bold text-ink">{weightLossPercentage > 0 ? `-${weightLossPercentage}%` : '0%'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                          <Icon name="users" className="h-4 w-4 text-brand-ink" />
                          <div>
                            <p className="text-[11px] text-ink-muted">Members</p>
                            <p className="text-sm font-bold text-ink">{participants.length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                        <StackedAvatars participants={participants} size="md" maxVisible={5} showCount={false} />
                        <span className="flex items-center gap-1 text-sm font-semibold text-brand-ink">
                          Leaderboard
                          <Icon name="chevron-right" className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-ink-subtle">
                        Code <span className="font-mono font-semibold tracking-wider text-ink-muted">{challenge.challengeCode}</span>
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Mobile quick actions */}
        {!authBlocked && userChallenges.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            <Button variant="secondary" onClick={handleJoinWithCode}>
              <Icon name="users" className="h-4 w-4" />
              Join
            </Button>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Icon name="plus" className="h-4 w-4" />
              Create
            </Button>
          </div>
        )}

        {/* Completed challenges */}
        <section aria-labelledby="completed-heading">
          <h2 id="completed-heading" className="section-title mb-3">History</h2>
          <button
            onClick={() => {
              if (authBlocked) {
                alert('Please log in to view completed challenges.')
                return
              }
              navigate('/completed-challenges')
            }}
            disabled={authBlocked}
            className="card card-interactive flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Icon name="award" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Completed challenges</span>
              <span className="block text-sm text-ink-muted">Past challenges and final results</span>
            </span>
            <Icon name="chevron-right" className="h-5 w-5 text-ink-subtle" />
          </button>
        </section>
      </div>

      {/* Challenge Form Modal */}
      {showForm && !authBlocked && (
        <ChallengeForm onCreate={handleCreateChallenge} onClose={() => setShowForm(false)} />
      )}

      {/* Challenge Info Modal */}
      {activeChallenge && !authBlocked && (
        <ChallengeInfoModal
          isOpen={showManagerModal}
          onClose={() => setShowManagerModal(false)}
          challenge={activeChallenge}
          onUpdate={handleChallengeUpdate}
        />
      )}

      {/* Join with code */}
      <Modal
        isOpen={!!(showJoinCodeModal && !authBlocked)}
        onClose={handleJoinCodeCancel}
        title="Join with a code"
        icon="users"
        footer={
          <>
            <Button variant="secondary" onClick={handleJoinCodeCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleJoinCodeSubmit} disabled={!challengeCode.trim()}>
              Join challenge
              <Icon name="arrow-right" className="h-4 w-4" />
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">Enter the challenge code from your friend or the challenge creator.</p>
        <label className="label" htmlFor="challenge-join-code">
          Challenge code
        </label>
        <input
          id="challenge-join-code"
          type="text"
          value={challengeCode}
          onChange={(e) => setChallengeCode(e.target.value)}
          placeholder="Enter challenge code"
          className="input font-mono uppercase tracking-widest"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJoinCodeSubmit()
          }}
        />
      </Modal>

      {/* Starting weight */}
      <Modal
        isOpen={!!(showStartingWeightModal && validatedChallenge && !authBlocked)}
        onClose={handleStartingWeightCancel}
        title="Your starting weight"
        icon="scale"
        footer={
          <>
            <Button variant="secondary" onClick={handleStartingWeightCancel}>
              Back
            </Button>
            <Button variant="primary" onClick={handleStartingWeightSubmit} disabled={!startingWeightValid}>
              Join challenge
              <Icon name="arrow-right" className="h-4 w-4" />
            </Button>
          </>
        }
      >
        {validatedChallenge && (
          <div className="callout callout-info mb-4">
            <Icon name="trophy" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{validatedChallenge.name}</p>
              <p className="opacity-90">This weight is used to track your progress through the challenge.</p>
            </div>
          </div>
        )}
        <label className="label" htmlFor="challenge-starting-weight">
          Starting weight (lbs)
        </label>
        <input
          id="challenge-starting-weight"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={startingWeight}
          onChange={(e) => setStartingWeight(e.target.value)}
          placeholder="e.g. 154.5"
          className="input"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleStartingWeightSubmit()
          }}
        />
        <p className="mt-2 text-sm text-ink-muted">Enter your current weight in pounds.</p>
      </Modal>

      {/* Completed challenge */}
      <Modal
        isOpen={!!(showCompletedChallengeModal && selectedCompletedChallenge && !authBlocked)}
        onClose={() => setShowCompletedChallengeModal(false)}
        title="Completed challenge"
        icon="award"
        footer={
          <Button variant="primary" onClick={() => setShowCompletedChallengeModal(false)}>
            Close
          </Button>
        }
      >
        {selectedCompletedChallenge && (
          <>
            <div className="mb-4 text-center">
              <h3 className="text-xl font-semibold text-ink">{selectedCompletedChallenge.name}</h3>
              <p className="text-sm text-ink-muted">
                {formatDate(selectedCompletedChallenge.startDate)} – {formatDate(selectedCompletedChallenge.endDate)}
              </p>
            </div>
            {completedChallengeRankings.length > 0 && (
              <div>
                <h4 className="section-title mb-2">Final rankings</h4>
                <ol className="overflow-hidden rounded-xl border border-line list-divided">
                  {completedChallengeRankings.map((participant, index) => (
                    <li key={participant.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="w-6 text-center font-bold tabular-nums text-brand-ink">{participant.rank || index + 1}</span>
                        <span className="font-medium text-ink">{(participant.name || 'Unknown User').split(' ')[0]}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-ink-muted">{participant.totalPoints || 0} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}

export default Challenge
