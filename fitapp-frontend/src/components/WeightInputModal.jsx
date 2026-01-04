import React, { useState, useEffect } from 'react'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

/**
 * WeightInputModal Component
 * 
 * Handles weight confirmation for challenges on weigh-in days:
 * - Automatically fetches most recent weight from Google Fit (synced daily)
 * - Shows weight for user confirmation
 * - Allows manual entry if needed
 * - Only available on weigh-in days
 * 
 * Props:
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {object} challenge - The challenge object
 * @param {function} onWeightSubmitted - Callback when weight is successfully submitted
 * @param {object} user - Current user object
 */
const WeightInputModal = ({ isOpen, onClose, challenge, onWeightSubmitted, user }) => {
  const [weight, setWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isWeighInDay, setIsWeighInDay] = useState(false)
  const [weightSource, setWeightSource] = useState(null) // 'google-fit' or 'manual'

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

  // Fetch the most recent weight from Google Fit (or use user's current weight)
  const fetchMostRecentWeight = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const apiUrl = getApiUrl()
      
      // First, try to get the most recent weight from Google Fit sync
      // This endpoint returns the most recent weight available (even if not from today)
      const response = await fetch(`${apiUrl}/api/sync-google-fit/${user.sub}`)
      
      if (!response.ok) {
        // If sync fails, fall back to user's stored weight
        if (user?.weight && user.weight > 0) {
          setWeight(user.weight.toFixed(1))
          setWeightSource('google-fit')
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch weight data')
      }
      
      const data = await response.json()
      
      // Use weight from Google Fit if available, otherwise use user's stored weight
      const mostRecentWeight = data.weight || user?.weight
      
      if (mostRecentWeight && mostRecentWeight > 0) {
        setWeight(mostRecentWeight.toFixed(1))
        setWeightSource('google-fit')
      } else {
        // No weight data available - user will need to enter manually
        setWeight('')
        setWeightSource(null)
        setError('No weight data found. Please enter your weight manually.')
      }
    } catch (err) {
      console.error('Error fetching weight:', err)
      // Fall back to user's stored weight if available
      if (user?.weight && user.weight > 0) {
        setWeight(user.weight.toFixed(1))
        setWeightSource('google-fit')
      } else {
        setWeight('')
        setWeightSource(null)
        setError('Unable to fetch weight from Google Fit. Please enter manually.')
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4" 
      style={{ alignItems: 'center' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Confirm Your Weight
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Challenge Info */}
          {challenge && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Challenge: {challenge.name}
              </p>
              {challenge.weighInDay && (
                <p className="text-xs text-blue-600">
                  Weekly weigh-in day: {challenge.weighInDay.charAt(0).toUpperCase() + challenge.weighInDay.slice(1)}
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Weight Confirmation Form */}
          {!loading && (
            <div className="space-y-4">
              {weightSource === 'google-fit' && weight && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    ✓ Most recent weight from Google Fit
                  </p>
                  <p className="text-xs text-green-600">
                    This is your most recent weight. Please confirm or edit if needed.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value)
                    if (weightSource === 'google-fit') {
                      setWeightSource('manual')
                    }
                  }}
                  placeholder="e.g., 154.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit()
                    }
                  }}
                />
                <p className="text-sm text-gray-600 mt-1">
                  {weightSource === 'google-fit' 
                    ? 'Confirm this weight or edit if it\'s not accurate.' 
                    : 'Enter your current weight in pounds.'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!weight.trim() || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0 || submitting}
                  className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
                    weight.trim() && !isNaN(parseFloat(weight)) && parseFloat(weight) > 0 && !submitting
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Confirming...' : 'Confirm Weight'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WeightInputModal

