import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import ChallengeForm from '../components/ChallengeForm'
import ChallengeDashboard from '../components/ChallengeDashboard'
import ChallengeInfoModal from '../components/ChallengeInfoModal'
import Button from '../components/ui/Button'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
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

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackToChallenges}
            className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200"
            aria-label="Back to Challenges"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">
            FitApp
          </h1>
          {activeChallenge ? (
            <button
              onClick={() => setShowManagerModal(true)}
              className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200"
              aria-label="Challenge settings"
            >
              <svg 
                width="24" 
                height="24" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fillRule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          ) : (
            <div className="w-10"></div>
          )}
        </div>
      </header>

      {/* Edge-to-edge challenge photo banner (4:1 ratio) - Mobile only */}
      {activeChallenge && (
        <div className="md:hidden w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]" style={{ marginTop: '48px' }}>
          <div className="relative w-full" style={{ paddingBottom: '25%' }}> {/* 4:1 aspect ratio */}
            {/* Background image */}
            {activeChallenge.photo ? (
              <img
                src={`${getApiUrl()}${activeChallenge.photo}`}
                alt={activeChallenge.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-500 to-blue-800"></div>
            )}
            
            {/* Overlay gradient for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent"></div>
            
            {/* Challenge name overlay - centered */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg text-center">
                {activeChallenge.name}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Desktop header with challenge name - Desktop only */}
      {activeChallenge && (
        <div className="hidden md:block max-w-md mx-auto bg-gray-50 pt-20">
          <div className="p-6 pb-0">
            <h1 className="text-4xl font-bold text-blue-600 leading-tight mb-6">
              {activeChallenge.name} Leaderboard
            </h1>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className={`p-6 pb-24 ${activeChallenge ? 'md:pt-0 pt-6' : 'pt-20'}`}>

      {!activeChallenge && !showForm && (
        <div className="bg-white rounded-2xl p-8 space-y-6 text-center shadow-lg">
          {checkingChallenges ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <p className="text-gray-700 text-lg">
                You're not in a challenge yet. What would you like to do?
              </p>
              <div className="flex justify-center space-x-4">
                <Button
                  variant="primary"
                  onClick={() => setShowForm(true)}
                  size="md"
                >
                  ➕ Create Challenge
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleJoinWithCode}
                  size="md"
                >
                  👥 Join with Code
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {showForm && !activeChallenge && (
        <ChallengeForm onCreate={handleCreateChallenge} />
      )}

      {activeChallenge && (
        <div className="space-y-6">
          {/* Show warning if this is a local challenge */}
          {!activeChallenge._id && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
              <p className="text-yellow-800 text-sm">
                ⚠️ This is a local challenge. To see live leaderboard data, create a new challenge in the backend.
              </p>
              <Button
                variant="secondary"
                onClick={handleClearAndCreateNew}
                size="sm"
                className="mt-3"
              >
                Create New Backend Challenge
              </Button>
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

      {/* Join with Code Modal */}
      {showJoinCodeModal && (
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
                <h2 className="text-2xl font-bold text-gray-800">Join Challenge with Code 👥</h2>
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
                    Join Challenge 🚀
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Starting Weight Modal */}
      {showStartingWeightModal && validatedChallenge && (
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
                <h2 className="text-2xl font-bold text-gray-800">Enter Your Starting Weight ⚖️</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Starting Weight (lbs) ⚖️
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
                    Join Challenge 🚀
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

export default Leaderboard
