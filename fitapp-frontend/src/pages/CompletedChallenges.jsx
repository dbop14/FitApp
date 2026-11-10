import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'

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
      <>
        <PageHeader title="Completed challenges" back="/challenges" />
        <div className="page grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
        </div>
      </>
    )
  }

  const RANK_BADGE = {
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-surface-3 text-ink-muted',
    3: 'bg-orange-100 text-orange-700',
  }

  return (
    <>
      <PageHeader title="Completed challenges" subtitle="Past challenges and final results" back="/challenges" />

      <div className="page">
        {completedChallenges.length === 0 ? (
          <EmptyState
            icon="award"
            title="No completed challenges yet"
            action={
              <button onClick={() => navigate('/challenges')} className="btn btn-secondary">
                View active challenges
                <Icon name="arrow-right" className="h-4 w-4" />
              </button>
            }
          >
            Finish a challenge to see its results here.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {completedChallenges.map((challenge) => (
              <article
                key={challenge._id}
                onClick={() => handleChallengeClick(challenge)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    handleChallengeClick(challenge)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`View results for ${challenge.name}`}
                className="card card-pad card-interactive flex cursor-pointer flex-col"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Icon name="award" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink">{challenge.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}
                    </p>
                  </div>
                  {challenge._id && (
                    <button
                      onClick={(e) => handleDeleteChallenge(challenge, e)}
                      className="icon-btn -mr-2 -mt-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${challenge.name}`}
                      title="Delete challenge"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="chip chip-neutral">Completed</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-brand-ink">
                    View results
                    <Icon name="chevron-right" className="h-4 w-4" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Rankings */}
      <Modal
        isOpen={!!(selectedChallenge && showRankingsModal)}
        onClose={() => setShowRankingsModal(false)}
        title={selectedChallenge?.name || 'Results'}
        icon="award"
      >
        {selectedChallenge && (
          <>
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <Icon name="calendar" className="h-4 w-4 text-ink-muted" />
              <span className="text-ink-muted">Challenge period</span>
              <span className="ml-auto font-semibold text-ink">
                {formatDate(selectedChallenge.startDate)} – {formatDate(selectedChallenge.endDate)}
              </span>
            </div>
            <h3 className="section-title mb-2">Final rankings</h3>
            {challengeRankings.length > 0 ? (
              <ol className="overflow-hidden rounded-xl border border-line list-divided">
                {challengeRankings.map((participant, index) => {
                  const rank = participant.rank || index + 1
                  return (
                    <li key={participant.userId} className="flex items-center gap-3 px-3 py-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${RANK_BADGE[rank] || 'text-ink-subtle'}`}
                      >
                        {rank <= 3 ? <Icon name="medal" className="h-4 w-4" strokeWidth={2} /> : rank}
                      </span>
                      <span className="flex-1 font-medium text-ink">
                        {(participant.userName || participant.name || participant.displayName || 'Unknown User').split(' ')[0]}
                        {rank <= 3 && <span className="sr-only"> rank {rank}</span>}
                      </span>
                      <span className="font-semibold tabular-nums text-ink-muted">
                        {participant.totalPoints?.toLocaleString() || participant.points?.toLocaleString() || 0} pts
                      </span>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center py-8 text-sm text-ink-muted">
                <LoadingSpinner size="sm" />
                <p className="mt-2">Loading rankings...</p>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!(showDeleteModal && challengeToDelete)}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="Delete challenge"
        icon="trash"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary" disabled={deleting}>
              Cancel
            </button>
            <button onClick={confirmDeleteChallenge} className="btn btn-danger" disabled={deleting}>
              {deleting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Delete challenge'}
            </button>
          </>
        }
      >
        {challengeToDelete && (
          <>
            <p className="text-ink">
              Delete <span className="font-semibold">"{challengeToDelete.name}"</span>?
            </p>
            <div className="callout callout-danger mt-4">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>This can't be undone. All challenge data will be permanently deleted.</p>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default CompletedChallenges
