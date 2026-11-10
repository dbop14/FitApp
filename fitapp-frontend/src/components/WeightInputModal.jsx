import React, { useState, useEffect } from 'react'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import Modal from './ui/Modal'
import Icon from './ui/Icon'
import LoadingSpinner from './ui/LoadingSpinner'

/**
 * WeightInputModal Component
 * 
 * Handles weight confirmation for challenges on weigh-in days:
 * - Automatically fetches most recent weight from user's data source (Google Fit or Fitbit)
 * - Shows weight for user confirmation
 * - Allows manual entry if needed
 * - Only available on weigh-in days
 * 
 * Props:
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {object} challenge - The challenge object
 * @param {function} onWeightSubmitted - Callback when weight is successfully submitted
 * @param {object} user - Current user object (includes dataSource: 'google-fit' | 'fitbit')
 */
// Where a pre-filled weight came from. WHOOP weight is not used, so WHOOP users
// see their last logged weight ('history').
const WEIGHT_SOURCE_LABELS = { 'google-fit': 'Google Fit', fitbit: 'Fitbit', 'google-health': 'Google Health', history: 'your last weigh-in' }

const WeightInputModal = ({ isOpen, onClose, challenge, onWeightSubmitted, user }) => {
  const [weight, setWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isWeighInDay, setIsWeighInDay] = useState(false)
  const [weightSource, setWeightSource] = useState(null) // a WEIGHT_SOURCE_LABELS key, or 'manual'
  const isPrefilled = Boolean(weightSource && weightSource !== 'manual')

  // Check if today is a weigh-in day (including first weigh-in day for future challenges)
  useEffect(() => {
    if (!challenge?.weighInDay) {
      setIsWeighInDay(false)
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Parse startDate (handle both date-only and datetime formats)
    let startDate = null
    if (challenge.startDate) {
      if (challenge.startDate.includes('T')) {
        startDate = new Date(challenge.startDate)
      } else {
        const dateMatch = challenge.startDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          startDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
        } else {
          startDate = new Date(challenge.startDate)
        }
      }
      startDate.setHours(0, 0, 0, 0)
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayDayName = dayNames[today.getDay()]
    const isTodayWeighInDay = challenge.weighInDay.toLowerCase() === todayDayName
    
    if (!isTodayWeighInDay) {
      setIsWeighInDay(false)
      return
    }
    
    // Check if challenge has started
    const challengeHasStarted = startDate && today >= startDate
    
    // Check if today is the first day of the challenge
    const isFirstDay = startDate && today.getTime() === startDate.getTime()
    
    // For future challenges (not started yet), only show on the first weigh-in day after start
    // For ongoing challenges, show on regular weigh-in days
    if (!challengeHasStarted) {
      // Challenge hasn't started yet - don't show weight input
      setIsWeighInDay(false)
    } else if (isFirstDay && isTodayWeighInDay) {
      // Challenge starts today and today is weigh-in day - show to set starting weight
      setIsWeighInDay(true)
    } else if (isFirstDay) {
      // Challenge starts today but not a weigh-in day - wait for first weigh-in day
      setIsWeighInDay(false)
    } else {
      // Challenge has started and it's a regular weigh-in day
      setIsWeighInDay(true)
    }
  }, [challenge])

  // Auto-fetch most recent weight when modal opens on weigh-in day
  useEffect(() => {
    if (isOpen && isWeighInDay && user?.sub) {
      fetchMostRecentWeight()
    }
  }, [isOpen, isWeighInDay, user?.sub])

  // Fetch the most recent weight from user's data source (Google Fit or Fitbit) or fitness history
  const fetchMostRecentWeight = async () => {
    setLoading(true)
    setError(null)
    const dataSource = user?.dataSource || 'google-fit'
    // Weight comes from Google Fit (legacy) or Google Health; WHOOP weight is not
    // used, so WHOOP and no-source users get their last logged weight.
    const sourceLabel = WEIGHT_SOURCE_LABELS[dataSource] || 'your last weigh-in'

    try {
      const apiUrl = getApiUrl()
      let mostRecentWeight = null

      if (dataSource !== 'google-fit') {
        // Server-synced sources: GET userdata syncs (when possible) and returns the stored weight
        const response = await fetchWithAuth(`${apiUrl}/api/user/userdata?googleId=${user.sub}`)
        if (response.ok) {
          const data = await response.json()
          mostRecentWeight = data.weight ?? user?.weight
        }
      } else {
        // Google Fit: sync endpoint returns most recent weight
        const response = await fetch(`${apiUrl}/api/sync-google-fit/${user.sub}`)
        if (response.ok) {
          const data = await response.json()
          mostRecentWeight = data.weight ?? user?.weight
        }
      }

      if (!mostRecentWeight && (user?.weight && user.weight > 0)) {
        mostRecentWeight = user.weight
      }

      // If still no weight, try fitness history (works for both Fitbit and Google Fit)
      if ((!mostRecentWeight || mostRecentWeight <= 0) && user?.sub) {
        const historyResponse = await fetchWithAuth(`${apiUrl}/api/user/fitness-history/${user.sub}?limit=30`)
        if (historyResponse.ok) {
          const history = await historyResponse.json()
          const entry = history.find(e => e.weight != null && e.weight > 0)
          if (entry) mostRecentWeight = entry.weight
        }
      }

      const weightSourceKey = WEIGHT_SOURCE_LABELS[dataSource] ? dataSource : 'history'
      if (mostRecentWeight && mostRecentWeight > 0) {
        setWeight(mostRecentWeight.toFixed(1))
        setWeightSource(weightSourceKey)
      } else {
        setWeight('')
        setWeightSource(null)
        setError('No weight data found. Please enter your weight manually.')
      }
    } catch (err) {
      console.error('Error fetching weight:', err)
      if (user?.weight && user.weight > 0) {
        setWeight(user.weight.toFixed(1))
        setWeightSource(WEIGHT_SOURCE_LABELS[dataSource] ? dataSource : 'history')
      } else {
        setWeight('')
        setWeightSource(null)
        setError(`Unable to fetch weight from ${sourceLabel}. Please enter manually.`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Submit weight
  const handleSubmit = async () => {
    const weightValue = parseFloat(weight)
    
    if (!weight || isNaN(weightValue) || weightValue <= 0) {
      setError('Please enter a valid weight.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const apiUrl = getApiUrl()
      
      // Get the user's local date (not server date) to ensure correct date is used
      // Use local date components to avoid timezone issues
      const localDate = new Date();
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      
      // Update participant weight
      const response = await fetchWithAuth(`${apiUrl}/api/challenge/${challenge._id}/participant/${user.sub}/weight`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weight: weightValue,
          date: localDateStr // Send user's local date in YYYY-MM-DD format
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update weight' }))
        throw new Error(errorData.error || 'Failed to update weight')
      }

      const result = await response.json()
      console.log('✅ Weight updated successfully:', result)
      

      // Call the callback
      if (onWeightSubmitted) {
        onWeightSubmitted(weightValue)
      }

      // Close the modal
      onClose()
    } catch (err) {
      console.error('Error submitting weight:', err)
      setError(err.message || 'Failed to submit weight. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Only show modal on weigh-in days
  if (!isOpen || !isWeighInDay) return null

  const weightValid = weight.trim() && !isNaN(parseFloat(weight)) && parseFloat(weight) > 0

  return (
    <Modal
      isOpen
      onClose={submitting ? undefined : onClose}
      title="Confirm your weight"
      icon="scale"
      footer={
        !loading && (
          <>
            <button onClick={onClose} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={!weightValid || submitting} className="btn btn-primary">
              <Icon name="check" className="h-4 w-4" />
              {submitting ? 'Confirming...' : 'Confirm weight'}
            </button>
          </>
        )
      }
    >
      {challenge && (
        <div className="callout callout-info mb-4">
          <Icon name="trophy" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{challenge.name}</p>
            {challenge.weighInDay && (
              <p className="opacity-90">
                Weekly weigh-in day: {challenge.weighInDay.charAt(0).toUpperCase() + challenge.weighInDay.slice(1)}
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          {isPrefilled && weight && (
            <div className="callout callout-success">
              <Icon name="check-circle" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Most recent weight from {WEIGHT_SOURCE_LABELS[weightSource] || 'your last weigh-in'}</p>
                <p className="opacity-90">Confirm it, or edit it if it's not right.</p>
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="weigh-in-weight">
              Your weight (lbs)
            </label>
            <input
              id="weigh-in-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value)
                if (isPrefilled) {
                  setWeightSource('manual')
                }
              }}
              placeholder="e.g. 154.5"
              className="input text-lg"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
            <p className="mt-1.5 text-sm text-ink-muted">
              {isPrefilled ? "Confirm this weight or edit it if it's not accurate." : 'Enter your current weight in pounds.'}
            </p>
          </div>

          {error && (
            <div className="callout callout-danger" role="alert">
              <Icon name="alert-circle" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default WeightInputModal
