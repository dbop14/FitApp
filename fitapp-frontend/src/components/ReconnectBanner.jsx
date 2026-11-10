import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { getDataSourceStatus } from '../utils/apiService'
import Icon from './ui/Icon'

const DISMISS_KEY = 'fitapp_reconnect_banner_dismissed'

// Tells users to connect, switch or reconnect: no source yet, still on Google
// Fit or Fitbit (no longer selectable), or a Google Health / WHOOP grant that
// stopped working. Shown only when a new source is enabled.
const ReconnectBanner = () => {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (!user?.sub || dismissed) return
    let cancelled = false
    getDataSourceStatus(user.sub)
      .then((s) => { if (!cancelled) setStatus(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.sub, dismissed])

  const anySourceAvailable = status?.googleHealthEnabled || status?.whoopEnabled
  if (dismissed || !anySourceAvailable || !(status?.needsReconnect || status?.shouldSwitchSource)) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  const choices = [status.googleHealthEnabled && 'Google Health', status.whoopEnabled && 'WHOOP'].filter(Boolean).join(' or ')
  const MESSAGES = {
    fitbit: 'Fitbit shut down its old connection, so your steps are not syncing. Reconnect through Google Health to keep earning points.',
    'google-fit': `Google Fit shuts down at the end of 2026. Switch to ${choices} to keep your steps syncing.`,
    none: `Connect ${choices} to start syncing your steps and workouts.`,
    whoop: 'Your WHOOP connection stopped working. Reconnect to keep your steps syncing.',
  }
  const message = MESSAGES[status.dataSource] || 'Your Google Health connection stopped working. Reconnect to keep your steps syncing.'
  const buttonLabel = status.dataSource === 'none' ? 'Connect' : status.dataSource === 'google-fit' ? 'Switch' : 'Reconnect'

  return (
    <div className="callout callout-warning mb-4 items-start" role="status">
      <Icon name="unlink" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/data-source-settings')} className="btn btn-sm btn-primary">
            {buttonLabel}
          </button>
          <button onClick={dismiss} className="btn btn-sm btn-ghost">
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReconnectBanner
