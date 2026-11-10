import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import ChallengeForm from '../components/ChallengeForm'
import ChallengeDashboard from '../components/ChallengeDashboard'
import ChallengeInfoModal from '../components/ChallengeInfoModal'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { API_BASE_URL } from '../utils/constants'
import { getApiUrl, fetchWithAuth } from '../utils/apiService'

/**
 * Leaderboard Component - Refactored to align with unified design system
 * 
 * Design System Implementation:
 * - Layout: Follows designSystem.layoutPatterns.leaderboard structure
 * - Components: Uses design system components for consistency
 * - Styling: Applies design system color palette and typography
 * 
 * API Integration Preserved:
 * - Challenge management and participant data
 * - User rank and leaderboard data
 * - Auto-refresh functionality
 */

const Leaderboard = () => {
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
  const [checkingChallenges, setCheckingChallenges] = useState(false)

  // Debug: Log the challenge object
  console.log('🔍 Active Challenge:', activeChallenge)
  console.log('🔍 Challenge ID:', activeChallenge?._id)
  console.log('🔍 Challenge Code:', activeChallenge?.challengeCode)
  console.log('🔍 Challenge Participants:', activeChallenge?.participants)

  // Function to refresh leaderboard data
  const refreshLeaderboardData = async () => {
    if (activeChallenge?._id && user?.sub) {
      try {
        // Trigger a data refresh by updating participant data
        await fetch(`${API_BASE_URL}/api/update-participant/${activeChallenge._id}/${user.sub}`, {
          method: 'POST'
        })
        console.log('✅ Triggered leaderboard data refresh')
      } catch (err) {
        console.log('⚠️ Failed to refresh leaderboard data:', err)
      }
    }
  }

  // Check for existing challenges when component mounts
  useEffect(() => {
    const checkExistingChallenges = async () => {
      if (!user?.sub || activeChallenge) {
        return // Don't check if user is not logged in or already has an active challenge
      }
      
      // Don't check if we're currently showing the form (user is creating a new challenge)
      if (showForm) {
        console.log('🚫 Skipping challenge check - user is creating a new challenge');
        return;
      }

      // Check if challenge data was recently cleared (indicating user just left a challenge)
      const challengeClearedRecently = sessionStorage.getItem('fitapp_challenge_cleared');
      if (challengeClearedRecently) {
        const clearTime = parseInt(challengeClearedRecently);
        const timeSinceClear = Date.now() - clearTime;
        if (timeSinceClear < 10000) { // Less than 10 seconds ago
          console.log('🚫 Challenge was recently cleared, not auto-loading challenges');
          return;
        } else {
          // Clean up old flag
          sessionStorage.removeItem('fitapp_challenge_cleared');
        }
      }

      try {
        setCheckingChallenges(true)
        console.log('🔍 Checking for existing challenges for user:', user.sub)
        
        const response = await fetchWithAuth(`${getApiUrl()}/api/user-challenges/${user.sub}`)
        
        if (response.ok) {
          const challenges = await response.json()
          console.log('✅ Found challenges:', challenges)
          
          // Filter out any challenges that might be marked as deleted or have invalid data
          const validChallenges = challenges.filter(challenge => 
            challenge && 
            challenge._id && 
            challenge._id !== 'undefined' && 
            challenge.name && 
            !challenge._deleted
          );
          
          console.log('🔍 Valid challenges after filtering:', validChallenges);
          
          if (validChallenges.length > 0) {
            // Use the first valid challenge found
            const firstChallenge = validChallenges[0]
            console.log('🏆 Loading valid challenge:', firstChallenge)
            saveChallenge(firstChallenge)
          } else {
            console.log('📊 No valid challenges found for user after filtering')
          }
        } else {
          console.log('📊 No challenges found for user')
        }
      } catch (err) {
        console.error('❌ Error checking for challenges:', err)
      } finally {
        setCheckingChallenges(false)
      }
    }

    checkExistingChallenges()
  }, [user?.sub, activeChallenge, saveChallenge, showForm])

  // Validate active challenge when component mounts or user changes
  useEffect(() => {
    const validateActiveChallenge = async () => {
      if (!activeChallenge?._id || !user?.sub) {
        return
      }

      try {
        const response = await fetchWithAuth(`${getApiUrl()}/api/user-challenges/${user.sub}`)

        if (response.ok) {
          const challenges = await response.json()
          const validChallenges = challenges.filter(
            challenge => challenge && challenge._id && !challenge._deleted
          )
          
          // Check if the active challenge still exists and is not deleted
          const challengeStillExists = validChallenges.some(c => c._id === activeChallenge._id)
          
          if (!challengeStillExists) {
            console.log('🗑️ Active challenge has been deleted, clearing from context')
            clearChallenge()
          }
        }
      } catch (err) {
        console.error('❌ Error validating active challenge:', err)
      }
    }

    validateActiveChallenge()
  }, [user?.sub, activeChallenge?._id, clearChallenge])

  // Auto-refresh leaderboard data when component mounts and when active challenge changes
  useEffect(() => {
    if (activeChallenge?._id && user?.sub) {
      refreshLeaderboardData()
    }
  }, [activeChallenge?._id, user?.sub])

  // Auto-refresh user data when page loads (but not too frequently)
  useEffect(() => {
    if (user?.sub && autoRefreshUserData) {
      // Only auto-refresh on Leaderboard if we haven't done it recently
      const lastAutoRefresh = sessionStorage.getItem('fitapp_last_auto_refresh');
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      if (!lastAutoRefresh || parseInt(lastAutoRefresh) < fiveMinutesAgo) {
        console.log('🔄 Auto-refreshing user data on Leaderboard page load...');
        autoRefreshUserData(false).then(() => {
          sessionStorage.setItem('fitapp_last_auto_refresh', now.toString());
        });
      } else {
        console.log('🕐 Auto-refresh skipped on Leaderboard - synced recently');
      }
    }
  }, [user?.sub, autoRefreshUserData])

  // Re-fetch data when post-login refresh completes
  useEffect(() => {
    if (lastDataRefresh && user?.sub && activeChallenge?._id) {
      console.log('📢 Leaderboard: Post-login refresh completed, updating data...')
      refreshLeaderboardData()
    }
  }, [lastDataRefresh, user?.sub, activeChallenge?._id])

  const handleJoinWithCode = () => {
    setShowJoinCodeModal(true)
  }

  const handleJoinCodeSubmit = async () => {
    if (!challengeCode.trim()) return

    try {
      // First, validate the challenge code
      const response = await fetch(`${API_BASE_URL}/api/challenge/code/${challengeCode.trim()}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Challenge lookup failed:', errorText)
        alert('Challenge not found. Please check the code and try again.')
        return
      }

      const challenge = await response.json()
      console.log('✅ Found challenge:', challenge)
      
      // Store the validated challenge and show starting weight modal
      setValidatedChallenge(challenge)
      setShowJoinCodeModal(false)
      setShowStartingWeightModal(true)
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

    // Validate starting weight
    const weight = parseFloat(startingWeight)
    if (!startingWeight.trim() || isNaN(weight) || weight <= 0) {
      alert('Please enter a valid starting weight.')
      return
    }

    try {
      // Join the challenge using the leaderboard participants endpoint
      const jwtToken = localStorage.getItem('fitapp_jwt_token')
      const participantResponse = await fetch(`${API_BASE_URL}/api/leaderboard/${validatedChallenge._id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': jwtToken ? `Bearer ${jwtToken}` : ''
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
        
        // Save challenge to context
        saveChallenge(validatedChallenge)
        
        // Small delay to ensure backend has processed the participant record
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Invalidate React Query cache to force refresh of challenges
        if (user?.sub) {
          await queryClient.invalidateQueries({ queryKey: ['challenges', user.sub] })
          console.log('✅ Invalidated challenges cache')
        }
        
        alert('Successfully joined the challenge!')
        setChallengeCode('')
        setStartingWeight('')
        setShowStartingWeightModal(false)
        setValidatedChallenge(null)
        
        // Navigate to challenge page to see the updated challenge list
        setTimeout(() => {
          navigate('/challenges')
        }, 300)
      } else {
        const error = await participantResponse.json().catch(() => ({ error: 'Unknown error' }))
        if (error.error === 'User is already a participant in this challenge') {
          alert('You are already a participant in this challenge.')
          setChallengeCode('')
          setStartingWeight('')
          setShowStartingWeightModal(false)
          setValidatedChallenge(null)
          saveChallenge(validatedChallenge)
          // Navigate to challenge page
          setTimeout(() => {
            navigate('/challenges')
          }, 500)
        } else {
          alert(`Failed to join challenge: ${error.error || 'Unknown error'}`)
        }
      }
    } catch (err) {
      console.error('Error joining challenge:', err)
      alert(`Failed to join challenge: ${err.message || 'Please try again.'}`)
    }
  }

  const handleStartingWeightCancel = () => {
    setShowStartingWeightModal(false)
    setStartingWeight('')
    setValidatedChallenge(null)
    setShowJoinCodeModal(true)
  }

  const handleBackToChallenges = () => {
    navigate('/challenges')
  }

  const handleCreateChallenge = (challengeData) => {
    console.log('🚀 Creating new challenge:', challengeData);
    
    // Validate the new challenge data
    if (!challengeData || !challengeData._id || challengeData._id === 'undefined') {
      console.error('❌ Invalid challenge data received:', challengeData);
      alert('Invalid challenge data received. Please try again.');
      return;
    }
    
    // Clear any existing challenge data first
    clearChallenge();
    
    // Clear any challenge clearing flags since we're creating a new one
    sessionStorage.removeItem('fitapp_challenge_cleared');
    
    // Wait a moment to ensure cleanup is complete
    setTimeout(() => {
      // Save the new challenge
      saveChallenge(challengeData);
      setShowForm(false);
      console.log('✅ New challenge created and saved');
    }, 100);
  }

  const handleClearAndCreateNew = () => {
    clearChallenge()
    setShowForm(true)
  }

  const handleChallengeUpdate = (updatedChallenge) => {
    // Check if this is a delete request
    if (updatedChallenge._delete) {
      console.log('🗑️ Challenge deletion requested, clearing context');
      clearChallenge();
      setShowManagerModal(false);
      // Set flag to prevent auto-reloading of challenges
      sessionStorage.setItem('fitapp_challenge_cleared', Date.now().toString());
      console.log('🚫 Set flag to prevent auto-challenge reload');
      return;
    }
    
    // Regular challenge update
    saveChallenge(updatedChallenge);
    setShowManagerModal(false);
  };

  const startingWeightValid =
    startingWeight.trim() && !isNaN(parseFloat(startingWeight)) && parseFloat(startingWeight) > 0

  return (
    <>
      <PageHeader
        title={activeChallenge ? activeChallenge.name : 'Leaderboard'}
        subtitle={activeChallenge ? 'Leaderboard' : undefined}
        back={handleBackToChallenges}
        actions={
          activeChallenge && (
            <button
              onClick={() => setShowManagerModal(true)}
              className="icon-btn-on-brand"
              aria-label="Challenge info and settings"
              title="Challenge info"
            >
              <Icon name="info" className="h-5 w-5" />
            </button>
          )
        }
      />

      <div className="page-narrow">
        {/* Challenge banner */}
        {activeChallenge && (
          <div className="relative mb-4 overflow-hidden rounded-2xl shadow-card">
            <div className="relative w-full pb-[30%] sm:pb-[22%]">
              {activeChallenge.photo ? (
                <img
                  src={`${getApiUrl()}${activeChallenge.photo}`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-800" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">Leaderboard</p>
                  <h2 className="truncate text-xl font-bold text-white drop-shadow sm:text-2xl">{activeChallenge.name}</h2>
                </div>
                {activeChallenge.scoringMode === 'v2' && (
                  <span className="chip shrink-0 bg-[rgb(255_255_255/0.2)] text-white backdrop-blur">Points v2</span>
                )}
              </div>
            </div>
          </div>
        )}

        {!activeChallenge && !showForm && (
          checkingChallenges ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <EmptyState
              icon="trophy"
              title="You're not in a challenge yet"
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="primary" onClick={() => setShowForm(true)}>
                    <Icon name="plus" className="h-4 w-4" />
                    Create challenge
                  </Button>
                  <Button variant="secondary" onClick={handleJoinWithCode}>
                    <Icon name="users" className="h-4 w-4" />
                    Join with code
                  </Button>
                </div>
              }
            >
              Create a new challenge or join one with a code from a friend.
            </EmptyState>
          )
        )}

        {showForm && !activeChallenge && <ChallengeForm onCreate={handleCreateChallenge} />}

        {activeChallenge && (
          <div className="space-y-4">
            {/* Local challenge warning */}
            {!activeChallenge._id && (
              <div className="callout callout-warning">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p>This is a local challenge. To see live leaderboard data, create a new challenge in the backend.</p>
                  <Button variant="secondary" onClick={handleClearAndCreateNew} size="sm" className="mt-3">
                    Create new backend challenge
                  </Button>
                </div>
              </div>
            )}

            <ChallengeDashboard />

            <ChallengeInfoModal
              isOpen={showManagerModal}
              onClose={() => setShowManagerModal(false)}
              challenge={activeChallenge}
              onUpdate={handleChallengeUpdate}
            />
          </div>
        )}
      </div>

      {/* Join with code */}
      <Modal
        isOpen={showJoinCodeModal}
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
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">
          Enter the challenge code from your friend or the challenge creator.
        </p>
        <label className="label" htmlFor="join-code">
          Challenge code
        </label>
        <input
          id="join-code"
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
        isOpen={!!(showStartingWeightModal && validatedChallenge)}
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
        <label className="label" htmlFor="starting-weight">
          Starting weight (lbs)
        </label>
        <input
          id="starting-weight"
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
    </>
  )
}

export default Leaderboard
