import { useState, useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
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

// One card per selectable source (WHOOP, Google Health)
const SourceCard = ({ id, name, icon, connected, onConnect, onDisconnect, connectLabel, blurb, activeText, highlight, children, dataSource, isLoading, onSwitch }) => {
  const active = dataSource === id
  return (
    <section
      className={`card overflow-hidden ${highlight ? 'ring-2 ring-blue-400' : ''} ${active ? 'border-blue-300' : ''}`}
      aria-labelledby={`src-${id}`}
    >
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            active ? 'bg-gradient-to-br from-blue-500 to-blue-800 text-white' : 'bg-surface-2 text-ink-muted'
          }`}
        >
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`src-${id}`} className="font-semibold text-ink">{name}</h3>
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-teal-500' : 'bg-surface-3'}`} aria-hidden="true" />
            {connected ? 'Connected' : 'Not connected'}
          </p>
        </div>
        {active && <span className="chip chip-brand">Active</span>}
        {!active && connected && (
          <button onClick={() => onSwitch(id)} disabled={isLoading} className="btn btn-sm btn-secondary">
            Switch
          </button>
        )}
      </div>
      <div className="border-t border-line px-4 py-4 sm:px-5">
        {!connected ? (
          <>
            <Button onClick={onConnect} disabled={isLoading} variant="primary" className="w-full">
              <Icon name="link" className="h-4 w-4" />
              {connectLabel}
            </Button>
            <p className="mt-2 text-center text-xs text-ink-muted">{blurb}</p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">{active ? activeText : 'Connected but not in use'}</p>
            <button onClick={onDisconnect} disabled={isLoading} className="btn btn-sm btn-ghost text-red-600 hover:text-red-700">
              <Icon name="unlink" className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
      {children}
    </section>
  )
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
      <PageHeader title="Data source" subtitle="Where your steps and workouts come from" back={handleBack} />

      <div className="page-narrow">
        {isLoadingStatus ? (
          <div className="space-y-4" aria-busy="true">
            <div className="skeleton h-36" />
            <div className="skeleton h-36" />
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="callout callout-danger" role="alert">
                <Icon name="alert-circle" className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            {success && (
              <div className="callout callout-success" role="status">
                <Icon name="check-circle" className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{success}</p>
              </div>
            )}

            {sourceLocks.length > 0 && (
              <div className="callout callout-info">
                <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Locked source: {SOURCE_LABELS[sourceLocks[0].lockedSource] || sourceLocks[0].lockedSource}
                  </p>
                  <p className="opacity-90">
                    You are in {sourceLocks.length === 1 ? `"${sourceLocks[0].challengeName}"` : `${sourceLocks.length} Points v2 challenges`}, which{' '}
                    {sourceLocks.length === 1 ? 'uses' : 'use'} the source you had when you joined until {sourceLocks.length === 1 ? 'it ends' : 'they end'}.
                  </p>
                </div>
              </div>
            )}

            {/* Legacy and missing sources: Google Fit and Fitbit can no longer be chosen */}
            {dataSource === 'google-fit' && (
              <div className="callout callout-warning">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">You're on Google Fit</p>
                  <p className="opacity-90">
                    Google Fit shuts down at the end of 2026. Your steps keep syncing until you switch, but once you connect {sourceChoices} you can't switch back.
                  </p>
                </div>
              </div>
            )}
            {dataSource === 'fitbit' && (
              <div className="callout callout-warning">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Fitbit is no longer syncing</p>
                  <p className="opacity-90">
                    Fitbit shut down its old connection on October 30, 2026. Connect Google Health to sync your Fitbit data again.
                  </p>
                </div>
              </div>
            )}
            {dataSource === 'none' && (
              <div className="callout callout-info">
                <Icon name="link" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Connect a data source</p>
                  <p className="opacity-90">Connect {sourceChoices} to start syncing your steps and workouts.</p>
                </div>
              </div>
            )}
            {!googleHealthEnabled && !whoopEnabled && (
              <div className="card card-pad text-center text-sm text-ink-muted">New data sources are coming soon.</div>
            )}

            {whoopEnabled && (
              <SourceCard
                dataSource={dataSource}
                isLoading={isLoading}
                onSwitch={handleDataSourceChange}
                id="whoop"
                name="WHOOP"
                icon="watch"
                connected={whoopConnected}
                onConnect={handleConnectWhoop}
                onDisconnect={handleDisconnectWhoop}
                connectLabel="Connect WHOOP"
                blurb="Syncs steps and workouts (with heart-rate zones) from WHOOP. Log weigh-ins in FitApp. Sleep and recovery are not read."
                activeText="Your steps and workouts sync from WHOOP"
              />
            )}

            {/* Google Health replaces the Fitbit Web API and, later, Google Fit */}
            {googleHealthEnabled && (
              <SourceCard
                dataSource={dataSource}
                isLoading={isLoading}
                onSwitch={handleDataSourceChange}
                id="google-health"
                name="Google Health"
                icon="heart-pulse"
                connected={googleHealthConnected}
                onConnect={handleConnectGoogleHealth}
                onDisconnect={handleDisconnectGoogleHealth}
                connectLabel="Connect Google Health"
                blurb="Syncs steps, workouts and weight from Fitbit devices and the Google Health app. Fitbit users: use this to reconnect."
                activeText="Your steps, workouts and weight sync from Google Health"
                highlight={dataSource === 'fitbit'}
              >
                {googleHealthConnected && (
                  <div className="border-t border-line px-4 py-4 sm:px-5">
                    <label htmlFor="max-hr" className="label mb-0">
                      Max heart rate
                    </label>
                    <p className="mt-1 text-xs text-ink-muted">
                      Used to work out Effort Points when your workouts don't include heart-rate zones. Leave blank to use {defaultMaxHeartRate} bpm. A rough guide is 220 minus your age.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative w-32">
                        <input
                          id="max-hr"
                          type="number"
                          inputMode="numeric"
                          min="120"
                          max="230"
                          placeholder={String(defaultMaxHeartRate)}
                          value={maxHeartRate}
                          onChange={(e) => setMaxHeartRate(e.target.value)}
                          className="input pr-12"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">bpm</span>
                      </div>
                      <button onClick={handleSaveMaxHeartRate} disabled={isLoading} className="btn btn-secondary ml-auto">
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </SourceCard>
            )}

            <div className="callout border-line bg-surface-2 text-ink-muted">
              <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>You can use one data source at a time. Weigh-ins are logged in FitApp. Sleep is never read.</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default DataSourceSettings
