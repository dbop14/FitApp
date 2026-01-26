import { useState } from 'react'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

/**
 * Hook for Fitbit data synchronization
 * Note: Fitbit API calls are handled by the backend, so this hook
 * primarily triggers backend syncs rather than calling Fitbit API directly
 */
const useFitbit = () => {
  const [steps, setSteps] = useState(null)
  const [weight, setWeight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  /**
   * Sync Fitbit data by triggering a backend fetch
   * The backend will handle Fitbit API calls and return the data
   */
  const syncFitbit = async (googleId) => {
    if (!googleId) {
      setError(new Error('Google ID is required'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const apiUrl = getApiUrl()
      const response = await fetchWithAuth(`${apiUrl}/api/user/userdata?googleId=${googleId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to sync Fitbit data' }))
        throw new Error(errorData.error || 'Failed to sync Fitbit data')
      }

      const data = await response.json()
      
      setSteps(data.steps || 0)
      setWeight(data.weight || null)
      setLastSync(data.lastSync ? new Date(data.lastSync) : new Date())

      console.log('✅ Fitbit sync successful:', { steps: data.steps, weight: data.weight })
    } catch (err) {
      console.error('❌ Fitbit sync error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return { steps, weight, syncFitbit, loading, error, lastSync }
}

export default useFitbit
