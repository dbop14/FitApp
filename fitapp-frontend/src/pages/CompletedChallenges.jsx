import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

/**
 * Completed Challenges Page - Shows all completed challenges
 * 
 * Features:
 * - Displays completed challenges in card format
 * - Shows final rankings for each challenge
 * - Clean, focused view without active challenges
 * - Future-proof delete functionality for all completed challenges
 * 
 * Future-Proofing:
 * - Dynamic challenge loading from API
 * - Property validation and fallbacks
 * - Safe delete operations with error handling
 * - Conditional delete button rendering
 * - Robust state management
 */

const CompletedChallenges = () => {
  const navigate = useNavigate()
  const { user } = useContext(UserContext)
  const [completedChallenges, setCompletedChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [showRankingsModal, setShowRankingsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [challengeToDelete, setChallengeToDelete] = useState(null)
  const [challengeRankings, setChallengeRankings] = useState([])
  const [deleting, setDeleting] = useState(false)

  // Fetch completed challenges
  const fetchCompletedChallenges = async () => {
    if (!user?.sub) return

    try {
      setLoading(true)
      const response = await fetchWithAuth(`${getApiUrl()}/api/user-challenges/${user.sub}`)
      
      if (response.ok) {
        const challenges = await response.json()
        console.log('✅ Fetched user challenges for completed page:', challenges)
        
        // Filter for only completed challenges and ensure they have required properties
        const now = new Date()
        // Helper to parse date string as local date (not UTC)
        const parseLocalDate = (dateString) => {
          if (!dateString) return null
          // If the string contains 'T' (datetime format), parse it directly as ISO datetime
          if (dateString.includes('T')) {
            return new Date(dateString)
          }
          const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
          if (dateMatch) {
            // Create date in local timezone (not UTC)
            return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
          }
          return new Date(dateString)
        }
        const completed = challenges
          .filter(challenge => {
            if (!challenge || !challenge.endDate || challenge._deleted) return false
            const endDate = parseLocalDate(challenge.endDate)
            // For date-only strings, use end of day (23:59:59.999) for comparison
            const isDateOnly = !challenge.endDate.includes('T')
            const endOfDay = isDateOnly ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999) : endDate
            return endOfDay < now
          })
          .map(challenge => ({
            ...challenge,
            // Ensure required properties exist with fallbacks
            _id: challenge._id || `challenge_${Date.now()}_${Math.random()}`,
            name: challenge.name || 'Unnamed Challenge',
            endDate: challenge.endDate || new Date().toISOString(),
            startDate: challenge.startDate || new Date().toISOString(),
            stepGoal: challenge.stepGoal || 0,
            participants: challenge.participants || [],
            challengeCode: challenge.challengeCode || 'N/A'
          }))
        
        console.log('✅ Processed completed challenges:', completed)
        setCompletedChallenges(completed)
      } else {
        console.log('📊 No challenges found for user')
      }
    } catch (err) {
      console.error('❌ Error fetching completed challenges:', err)
    } finally {
      setLoading(false)
    }
  }

  // Check for completed challenges when component mounts
  useEffect(() => {
    if (user?.sub) {
      fetchCompletedChallenges()
    }
  }, [user?.sub])

  const handleChallengeClick = async (challenge) => {
    console.log('📊 Viewing completed challenge:', challenge.name)
    setSelectedChallenge(challenge)
    setShowRankingsModal(true)
    
    // Fetch final rankings for the completed challenge
    try {
      const response = await fetchWithAuth(`${getApiUrl()}/api/leaderboard/${challenge._id}`)
      if (response.ok) {
        const rankings = await response.json()
        console.log('📊 Completed challenge rankings:', rankings)
        // Sort by rank (1st, 2nd, 3rd, etc.)
        const sortedRankings = rankings.sort((a, b) => (a.rank || 0) - (b.rank || 0))
        setChallengeRankings(sortedRankings)
      }
    } catch (err) {
      console.error('❌ Error fetching completed challenge rankings:', err)
      setChallengeRankings([])
    }
  }

  const handleDeleteChallenge = (challenge, e) => {
    e.stopPropagation() // Prevent opening the rankings modal
    setChallengeToDelete(challenge)
    setShowDeleteModal(true)
  }

  const confirmDeleteChallenge = async () => {
    if (!challengeToDelete || !challengeToDelete._id) {
      console.error('❌ No challenge selected for deletion or missing challenge ID')
      alert('Invalid challenge data. Please try again.')
      return
    }

    try {
      setDeleting(true)
      if (!user?.sub) {
        alert('User information not available. Please log in again.')
        return
      }

      const response = await fetchWithAuth(`${getApiUrl()}/api/challenge/${challengeToDelete._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          _delete: true,
          userGoogleId: user.sub
        })
      })

      if (response.ok) {
        console.log('✅ Challenge deleted successfully:', challengeToDelete.name)
        // Remove the deleted challenge from the list
        setCompletedChallenges(prev => prev.filter(c => c._id !== challengeToDelete._id))
        setShowDeleteModal(false)
        setChallengeToDelete(null)
        
        // Show success feedback
        console.log('🗑️ Challenge removed from completed challenges list')
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Failed to delete challenge:', response.status, errorData)
        alert(`Failed to delete challenge: ${errorData.error || 'Unknown error'}. Please try again.`)
      }
    } catch (err) {
      console.error('❌ Error deleting challenge:', err)
      alert('Failed to delete challenge. Please try again.')
    } finally {
      setDeleting(false)
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

  if (loading) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
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
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          {/* Page header */}
          <header className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={() => navigate('/challenges')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Back to challenges"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <h1 className="text-4xl font-bold text-blue-600 leading-tight">
                Completed Challenges
              </h1>
            </div>
            <p className="text-gray-600">
              View your past challenges and final results
            </p>
          </header>

          {/* Completed Challenges Section */}
          <section className="mb-8">
            {completedChallenges.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <div className="text-4xl mb-3">🏆</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No Completed Challenges Yet
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Complete a challenge to see it here!
                </p>
                <button
                  onClick={() => navigate('/challenges')}
                  className="text-blue-600 font-medium text-sm hover:underline"
                >
                  View Active Challenges →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {completedChallenges.map((challenge) => (
                  <div
                    key={challenge._id}
                    onClick={() => handleChallengeClick(challenge)}
                    className="bg-white rounded-2xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-shadow opacity-75"
                  >
                                        <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                          {challenge.name}
                        </h3>
                        <div className="text-sm text-gray-600">
                          {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
                          Completed
                        </span>
                        {challenge._id && (
                          <button
                            onClick={(e) => handleDeleteChallenge(challenge, e)}
                            className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500 hover:text-red-600"
                            aria-label="Delete challenge"
                            title="Delete challenge"
                          >
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 text-center">
                      <div className="text-blue-600 font-medium text-sm">
                        View Results →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Challenge Rankings Modal */}
          {selectedChallenge && showRankingsModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4"
              style={{ alignItems: 'center' }}
              onClick={() => setShowRankingsModal(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {selectedChallenge.name}
                    </h2>
                    <button
                      onClick={() => setShowRankingsModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Close modal"
                    >
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Challenge Period */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-gray-800 mb-2">Challenge Period</h3>
                    <p className="text-gray-600">
                      {formatDate(selectedChallenge.startDate)} - {formatDate(selectedChallenge.endDate)}
                    </p>
                  </div>

                  {/* Final Rankings */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Final Rankings</h3>
                    
                    {challengeRankings.length > 0 ? (
                      <div className="space-y-3">
                        {challengeRankings.map((participant, index) => {
                          const rank = participant.rank || index + 1
                          let rankColor = 'bg-gray-100 text-gray-600'
                          let rankBg = 'bg-gray-50'
                          
                          if (rank === 1) {
                            rankColor = 'bg-yellow-100 text-yellow-600'
                            rankBg = 'bg-yellow-50'
                          } else if (rank === 2) {
                            rankColor = 'bg-gray-100 text-gray-600'
                            rankBg = 'bg-gray-50'
                          } else if (rank === 3) {
                            rankColor = 'bg-orange-100 text-orange-600'
                            rankBg = 'bg-orange-50'
                          }
                          
                          return (
                            <div key={participant.userId} className={`flex items-center justify-between ${rankBg} rounded-lg p-4`}>
                              <div className="flex items-center space-x-3">
                                <div className={`flex items-center justify-center w-8 h-8 ${rankColor} rounded-full`}>
                                  <span className="text-sm font-bold">
                                    {rank}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">
                                    {(participant.userName || participant.name || participant.displayName || 'Unknown User').split(' ')[0]}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {participant.totalPoints?.toLocaleString() || participant.points?.toLocaleString() || 0} points
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">📊</div>
                        <p className="text-gray-500">Loading rankings...</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">Challenge completed</p>
                      <div className="text-2xl">🏆</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
                     )}

           {/* Delete Confirmation Modal */}
           {showDeleteModal && challengeToDelete && (
             <div
               className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4"
               style={{ alignItems: 'center' }}
               onClick={() => setShowDeleteModal(false)}
             >
               <div
                 className="bg-white rounded-2xl shadow-xl max-w-md w-full"
                 onClick={(e) => e.stopPropagation()}
               >
                 <div className="p-6">
                   {/* Header */}
                   <div className="text-center mb-6">
                     <div className="text-4xl mb-3">🗑️</div>
                     <h2 className="text-2xl font-bold text-gray-800 mb-2">
                       Delete Challenge
                     </h2>
                     <p className="text-gray-600">
                       Are you sure you want to delete "{challengeToDelete.name}"?
                     </p>
                   </div>

                   {/* Warning */}
                   <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                     <div className="flex items-center space-x-2">
                       <div className="text-red-600">
                         <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <p className="text-red-700 text-sm">
                         This action cannot be undone. All challenge data will be permanently deleted.
                       </p>
                     </div>
                   </div>

                   {/* Actions */}
                   <div className="flex space-x-3">
                     <button
                       onClick={() => setShowDeleteModal(false)}
                       className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                       disabled={deleting}
                     >
                       Cancel
                     </button>
                     <button
                       onClick={confirmDeleteChallenge}
                       className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                       disabled={deleting}
                     >
                       {deleting ? (
                         <div className="flex items-center justify-center">
                           <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                         </div>
                       ) : (
                         'Delete Challenge'
                       )}
                     </button>
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

export default CompletedChallenges
