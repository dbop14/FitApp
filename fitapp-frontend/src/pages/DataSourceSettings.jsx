import { useState, useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import Button from '../components/ui/Button'
import { getDataSourceStatus, updateDataSource, startGoogleHealthConnect, disconnectGoogleHealth, updateMaxHeartRate, startWhoopConnect, disconnectWhoop } from '../utils/apiService'

const GOOGLE_HEALTH_ERRORS = {
  ACCOUNT_NOT_LINKED: 'Your Fitbit login has not been moved to a Google account yet. Move it in the Fitbit app, then connect again.',
  scopes: 'Please allow both activity and body measurement access, then try again.',
  expired: 'The connection took too long. Please try again.',
  access_denied: 'Google Health access was not granted.',
  disabled: 'Google Health is not available yet.',
  locked: 'Your data source is locked for a Points v2 challenge you are in, so Google Health cannot become your source until it ends.',
}

const SOURCE_LABELS = { 'google-health': 'Google Health', 'google-fit': 'Google Fit', fitbit: 'Fitbit', whoop: 'WHOOP', none: 'No source' }

const WHOOP_ERRORS = {
  scopes: 'Please allow access to cycles, workouts, body measurements and profile, then try again.',
  expired: 'The connection took too long. Please try again.',
  access_denied: 'WHOOP access was not granted.',
  locked: 'Your data source is locked for a Points v2 challenge you are in, so WHOOP cannot become your source until it ends.',
  disabled: 'WHOOP is not available yet.',
}

const DataSourceSettings = () => {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [dataSource, setDataSource] = useState('google-fit')
  const [googleFitConnected, setGoogleFitConnected] = useState(false)
  const [fitbitConnected, setFitbitConnected] = useState(false)
  const [googleHealthEnabled, setGoogleHealthEnabled] = useState(false)
  const [googleHealthConnected, setGoogleHealthConnected] = useState(false)
  const [sourceLocks, setSourceLocks] = useState([])
  const [whoopEnabled, setWhoopEnabled] = useState(false)
  const [whoopConnected, setWhoopConnected] = useState(false)
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [defaultMaxHeartRate, setDefaultMaxHeartRate] = useState(185)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const successMsg = searchParams.get('success')
    const errorMsg = searchParams.get('error')
    const googleHealthResult = searchParams.get('googleHealth')
    const whoopResult = searchParams.get('whoop')

    if (googleHealthResult === 'connected') {
      setSuccess('Google Health connected. Your last 30 days are being imported.')
      loadDataSourceStatus()
      navigate('/data-source-settings', { replace: true })
    } else if (googleHealthResult === 'error') {
      const reason = searchParams.get('reason') || ''
      setError(GOOGLE_HEALTH_ERRORS[reason] || `Could not connect Google Health (${reason || 'unknown error'}).`)
      navigate('/data-source-settings', { replace: true })
    } else if (whoopResult === 'connected') {
      setSuccess('WHOOP connected. Your last 30 days are being imported.')
      loadDataSourceStatus()
      navigate('/data-source-settings', { replace: true })
    } else if (whoopResult === 'error') {
      const reason = searchParams.get('reason') || ''
      setError(WHOOP_ERRORS[reason] || `Could not connect WHOOP (${reason || 'unknown error'}).`)
      navigate('/data-source-settings', { replace: true })
    } else if (successMsg === 'fitbit_connected') {
      setSuccess('Fitbit connected successfully!')
      // Refresh status
      loadDataSourceStatus()
      // Clear URL params
      navigate('/data-source-settings', { replace: true })
    } else if (errorMsg) {
      setError(decodeURIComponent(errorMsg))
      // Clear URL params
      navigate('/data-source-settings', { replace: true })
    }
  }, [searchParams, navigate])

  // Load data source status on mount
  useEffect(() => {
    if (user?.sub) {
      loadDataSourceStatus()
    }
  }, [user])

  const loadDataSourceStatus = async () => {
    if (!user?.sub) return
    
    setIsLoadingStatus(true)
    setError('')
    
    try {
      const status = await getDataSourceStatus(user.sub)
      setDataSource(status.dataSource || 'google-fit')
      setGoogleFitConnected(status.googleFitConnected || false)
      setFitbitConnected(status.fitbitConnected || false)
      setGoogleHealthEnabled(status.googleHealthEnabled || false)
      setGoogleHealthConnected(status.googleHealthConnected || false)
      setSourceLocks(status.sourceLocks || [])
      setWhoopEnabled(status.whoopEnabled || false)
      setWhoopConnected(status.whoopConnected || false)
      setMaxHeartRate(status.maxHeartRate ? String(status.maxHeartRate) : '')
      if (status.defaultMaxHeartRate) setDefaultMaxHeartRate(status.defaultMaxHeartRate)
    } catch (err) {
      console.error('Failed to load data source status:', err)
      setError('Failed to load data source status')
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleDataSourceChange = async (newDataSource) => {
    if (!user?.sub) return
    
    // Don't allow switching if already selected
    if (newDataSource === dataSource) return
    
    setIsLoading(true)
    setError('')
    setSuccess('')
    
    try {
      await updateDataSource(user.sub, newDataSource)
      setDataSource(newDataSource)
      setSuccess(`Data source switched to ${getDataSourceDisplayName(newDataSource)}`)
      
      // Update user context if available
      if (user) {
        // The user context will be updated on next data fetch
      }
    } catch (err) {
      console.error('Failed to update data source:', err)
      setError(err.message || 'Failed to update data source')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectGoogleHealth = async () => {
    setIsLoading(true)
    setError('')
    try {
      await startGoogleHealthConnect()
    } catch (err) {
      setError(err.message || 'Could not start the Google Health connection')
      setIsLoading(false)
    }
  }

  const handleDisconnectGoogleHealth = async () => {
    setIsLoading(true)
    setError('')
    try {
      let result
      try {
        result = await disconnectGoogleHealth()
      } catch (err) {
        if (!err.locked || !window.confirm(`${err.message}\n\nDisconnect anyway?`)) throw err
        result = await disconnectGoogleHealth({ confirm: true })
      }
      setGoogleHealthConnected(false)
      setDataSource(result.dataSource || 'none')
      setSuccess('Google Health disconnected')
    } catch (err) {
      setError(err.message || 'Could not disconnect Google Health')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectWhoop = async () => {
    setIsLoading(true)
    setError('')
    try {
      await startWhoopConnect()
    } catch (err) {
      setError(err.message || 'Could not start the WHOOP connection')
      setIsLoading(false)
    }
  }

  const handleDisconnectWhoop = async () => {
    setIsLoading(true)
    setError('')
    try {
      let result
      try {
        result = await disconnectWhoop()
      } catch (err) {
        if (!err.locked || !window.confirm(`${err.message}\n\nDisconnect anyway?`)) throw err
        result = await disconnectWhoop({ confirm: true })
      }
      setWhoopConnected(false)
      setDataSource(result.dataSource || 'none')
      setSuccess('WHOOP disconnected')
    } catch (err) {
      setError(err.message || 'Could not disconnect WHOOP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveMaxHeartRate = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await updateMaxHeartRate(maxHeartRate.trim() === '' ? null : Number(maxHeartRate))
      setMaxHeartRate(result.maxHeartRate ? String(result.maxHeartRate) : '')
      setSuccess(result.maxHeartRate ? `Max heart rate set to ${result.maxHeartRate}` : `Max heart rate reset to the default (${result.defaultMaxHeartRate})`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const sourceChoices = [googleHealthEnabled && 'Google Health', whoopEnabled && 'WHOOP'].filter(Boolean).join(' or ') || 'a new source'

  const handleBack = () => {
    navigate('/settings')
  }

  const getDataSourceDisplayName = (source) => {
    if (source === 'fitbit') return 'Fitbit'
    if (source === 'google-health') return 'Google Health'
    if (source === 'whoop') return 'WHOOP'
    return 'Google Fit'
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-center text-white flex-1">
            Data Source
          </h1>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          {/* Page header */}
          <div className="mb-6">
            <h1 className={unifiedDesignSystem.typography.hierarchy.pageTitle}>
              Data Source Settings
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Choose where your steps and workouts come from
            </p>
          </div>

          {isLoadingStatus ? (
            <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sourceLocks.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    Locked source: {SOURCE_LABELS[sourceLocks[0].lockedSource] || sourceLocks[0].lockedSource}
                  </p>
                  <p className="text-xs text-blue-800 mt-1">
                    You are in {sourceLocks.length === 1 ? `"${sourceLocks[0].challengeName}"` : `${sourceLocks.length} Points v2 challenges`}, which {sourceLocks.length === 1 ? 'uses' : 'use'} the source you had when you joined until {sourceLocks.length === 1 ? 'it ends' : 'they end'}. 
                  </p>
                </div>
              )}
              {/* Legacy and missing sources: Google Fit and Fitbit can no longer be chosen */}
              {dataSource === 'google-fit' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-amber-900">You're on Google Fit</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Google Fit shuts down at the end of 2026. Your steps keep syncing until you switch, but once you connect {sourceChoices} you can't switch back.
                  </p>
                </div>
              )}
              {dataSource === 'fitbit' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-amber-900">Fitbit is no longer syncing</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Fitbit shut down its old connection on October 30, 2026. Connect Google Health to sync your Fitbit data again.
                  </p>
                </div>
              )}
              {dataSource === 'none' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-blue-900">Connect a data source</p>
                  <p className="text-xs text-blue-800 mt-1">
                    Connect {sourceChoices} to start syncing your steps and workouts.
                  </p>
                </div>
              )}
              {!googleHealthEnabled && !whoopEnabled && (
                <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
                  <p className="text-sm text-gray-600">New data sources are coming soon.</p>
                </div>
              )}

              {/* WHOOP Option */}
              {whoopEnabled && (
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">W</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">WHOOP</h3>
                        <p className="text-sm text-gray-600">{whoopConnected ? 'Connected' : 'Not connected'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {dataSource === 'whoop' && <span className="text-blue-600 font-semibold text-sm">Active</span>}
                      {dataSource !== 'whoop' && whoopConnected && (
                        <button
                          onClick={() => handleDataSourceChange('whoop')}
                          disabled={isLoading}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {!whoopConnected ? (
                      <>
                        <Button onClick={handleConnectWhoop} disabled={isLoading} variant="primary" size="md" className="w-full">
                          Connect WHOOP
                        </Button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Syncs steps and workouts (with heart-rate zones) from WHOOP. Log weigh-ins in FitApp. Sleep and recovery are not read.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {dataSource === 'whoop' ? 'Your steps and workouts sync from WHOOP' : 'Connected but not in use'}
                        </p>
                        <button
                          onClick={handleDisconnectWhoop}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Google Health Option (replaces the Fitbit Web API and, later, Google Fit) */}
              {googleHealthEnabled && (
                <div className={`bg-white rounded-2xl shadow-sm border p-6 ${dataSource === 'fitbit' ? 'ring-2 ring-blue-400' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-600">
                        <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s-7.5-4.6-9.6-9.3C1 8.5 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3C14.3 6.1 15.6 5 17.6 5 21 5 23 8.5 21.6 11.7 19.5 16.4 12 21 12 21z" fill="#4285F4"/>
                          <path d="M6 12h3l1.5-3 2 6 1.5-3h4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Google Health</h3>
                        <p className="text-sm text-gray-600">
                          {googleHealthConnected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {dataSource === 'google-health' && (
                        <span className="text-blue-600 font-semibold text-sm">Active</span>
                      )}
                      {dataSource !== 'google-health' && googleHealthConnected && (
                        <button
                          onClick={() => handleDataSourceChange('google-health')}
                          disabled={isLoading}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {!googleHealthConnected ? (
                      <>
                        <Button onClick={handleConnectGoogleHealth} disabled={isLoading} variant="primary" size="md" className="w-full">
                          Connect Google Health
                        </Button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Syncs steps, workouts and weight from Fitbit devices and the Google Health app. Fitbit users: use this to reconnect.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {dataSource === 'google-health'
                            ? 'Your steps, workouts and weight sync from Google Health'
                            : 'Connected but not in use'}
                        </p>
                        <button
                          onClick={handleDisconnectGoogleHealth}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                  {googleHealthConnected && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label htmlFor="max-hr" className="block text-sm font-medium text-gray-800">
                        Max heart rate
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Used to work out Effort Points when your workouts don't include heart-rate zones. Leave blank to use {defaultMaxHeartRate} bpm. A rough guide is 220 minus your age.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          id="max-hr"
                          type="number"
                          inputMode="numeric"
                          min="120"
                          max="230"
                          placeholder={String(defaultMaxHeartRate)}
                          value={maxHeartRate}
                          onChange={(e) => setMaxHeartRate(e.target.value)}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <span className="text-sm text-gray-600">bpm</span>
                        <button
                          onClick={handleSaveMaxHeartRate}
                          disabled={isLoading}
                          className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error and Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 text-sm">{success}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> You can use one data source at a time. Weigh-ins are logged in FitApp. Sleep is never read.
                </p>
              </div>
            </div>
          )}

          {/* Back Button */}
          <div className="mt-8">
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              size="lg"
              className="w-full"
            >
              Back to Settings
            </Button>
          </div>
        </main>
      </div>
    </>
  )
}

export default DataSourceSettings
