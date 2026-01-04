import { useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import ChallengeInfoModal from './ChallengeInfoModal'
import LeaderboardList from './ui/LeaderboardList'
import DashboardStates from './ui/DashboardStates'
import { DEFAULT_AVATAR, API_BASE_URL } from '../utils/constants'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import { useLeaderboard } from '../hooks/useLeaderboard'
import './ui/LeaderboardStyles.css'

const ChallengeDashboard = () => {
  const { challenge, clearChallenge } = useChallenge()
  const { user } = useContext(UserContext)
  const queryClient = useQueryClient()
  const [error, setError] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  
  // Use React Query hook for leaderboard data with caching
  const { data: leaderboardData, isLoading: leaderboardLoading, isFetching: leaderboardFetching, error: leaderboardError, refetch: refetchLeaderboard } = useLeaderboard(challenge?._id)
  
  // Transform leaderboard data to match component expectations
  const participantsData = (() => {
    if (!leaderboardData || !Array.isArray(leaderboardData) || leaderboardData.length === 0) {
      return []
    }
    
    return leaderboardData.map(participant => {
      // Calculate weight loss percentage
      let weightLossPercentage = null
      
      const startWeight = participant.startingWeight || participant.startWeight || participant.initialWeight
      let currentWeight = participant.lastWeight || participant.currentWeight || participant.weight
      
      if (!currentWeight && startWeight) {
        currentWeight = startWeight
      }
      
      if (startWeight && currentWeight) {
        const start = parseFloat(startWeight)
        const current = parseFloat(currentWeight)
        
        if (!isNaN(start) && !isNaN(current) && start > 0 && current > 0) {
          weightLossPercentage = Math.max(0, ((start - current) / start) * 100)
        }
      } else if (startWeight) {
        weightLossPercentage = 0
      }
      
      return {
        id: participant.userId,
        name: participant.name || 'Unknown User',
        avatar: participant.picture || DEFAULT_AVATAR,
        totalPoints: participant.points || 0,
        stepGoalPoints: participant.stepGoalPoints || 0,
        weightLossPoints: participant.weightLossPoints || 0,
        lastStepCount: participant.lastStepCount || 0,
        lastStepDate: participant.lastStepDate,
        startWeight: startWeight,
        currentWeight: currentWeight,
        weightLossPercentage: weightLossPercentage,
        isCurrentUser: participant.userId === user?.sub
      }
    })
  })()
  
  // Only show loading if we have no cached data
  const loading = leaderboardLoading && !leaderboardData
  
  // Set error from React Query if present
  useEffect(() => {
    if (leaderboardError) {
      setError(`Failed to load leaderboard: ${leaderboardError.message}`)
    } else {
      setError(null)
    }
  }, [leaderboardError])

  // Design system tokens
  const { components, spacing, layout } = unifiedDesignSystem

  // Handle challenge updates - integrated with Leaderboard.jsx challenge management
  const handleChallengeUpdate = async (updatedData) => {
    try {
      console.log('🔍 Updating challenge with ID:', challenge._id)
      console.log('🔍 Full challenge object:', challenge)
      console.log('🔍 Update data:', updatedData)
      
      // If this is a delete request and we don't have a valid challenge ID, just clear the context
      if (updatedData._delete && (!challenge._id || challenge._id === 'undefined')) {
        console.log('⚠️ No valid challenge ID found, clearing context directly')
        clearChallenge()
        setShowInfoModal(false)
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/challenge/${challenge._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedData,
          userGoogleId: user.sub
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Challenge updated successfully', result)
        setShowInfoModal(false)
        
        // If challenge was deleted, clear it from context
        if (result.deleted) {
          console.log('🗑️ Challenge was deleted, clearing from context')
          clearChallenge()
        } else {
          // Refresh the leaderboard data
          refetchLeaderboard()
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to update challenge:', errorData)
        
        // If challenge not found and this is a delete request, just clear the context
        if (errorData.error === 'Challenge not found' && updatedData._delete) {
          console.log('⚠️ Challenge not found in database, clearing context directly')
          clearChallenge()
          setShowInfoModal(false)
          return
        }
        
        alert(`Failed to update challenge: ${errorData.error}`)
      }
    } catch (err) {
      console.error('❌ Error updating challenge:', err)
      alert('Failed to update challenge. Please try again.')
    }
  }

  // Handle card tap - integrated with Leaderboard.jsx interaction patterns
  const handleCardTap = (participant) => {
    console.log('👆 Card tapped:', participant)
    // Future enhancement: Show detailed participant view
    // This matches the pattern from Leaderboard.jsx for participant interactions
  }

  // Manual retry function
  const handleRetry = () => {
    setError(null)
    refetchLeaderboard()
  }

  // Sort participants by total points (descending) - matching Leaderboard.jsx data flow
  const leaderboard = [...participantsData].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))

  // Show warning for local challenges (matching Leaderboard.jsx pattern)
  const isLocalChallenge = !challenge?._id

  return (
    <div className="space-y-6">
      {/* Loading and Error States */}
      <DashboardStates loading={loading} error={error} onRetry={handleRetry} />

      {/* Local Challenge Warning */}
      {isLocalChallenge && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <p className="text-yellow-800 text-sm">
            ⚠️ This is a local challenge. To see live leaderboard data, create a new challenge in the backend.
          </p>
          <button
            onClick={() => {
              clearChallenge()
            }}
            className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Create New Backend Challenge
          </button>
        </div>
      )}

      {/* Leaderboard - Only show when not loading and no error */}
      {!loading && !error && (
        <>
          {leaderboard.length > 0 ? (
            <LeaderboardList
              participants={leaderboard}
              currentUserId={user?.sub}
              onCardTap={handleCardTap}
            />
          ) : (
            <div className="text-center py-12">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No Participants Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  This challenge doesn't have any participants yet. Be the first to join!
                </p>
                <div className="text-sm text-gray-500">
                  <p>• Challenge Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{challenge?.challengeCode}</span></p>
                  <p>• Share this code with friends to invite them</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Challenge Info Modal */}
      <ChallengeInfoModal
        challenge={challenge}
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onUpdate={handleChallengeUpdate}
      />
    </div>
  )
}

export default ChallengeDashboard
