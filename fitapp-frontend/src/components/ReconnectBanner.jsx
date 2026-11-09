import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { getDataSourceStatus } from '../utils/apiService'

const DISMISS_KEY = 'fitapp_reconnect_banner_dismissed'

// Tells users whose data source stopped working (legacy Fitbit, or an expired
// Google Health grant) to reconnect. Shown only when Google Health is enabled.
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

  if (dismissed || !status?.needsReconnect || !status?.googleHealthEnabled) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  const message = status.dataSource === 'fitbit'
    ? 'Fitbit shut down its old connection, so your steps are not syncing. Reconnect through Google Health to keep earning points.'
    : 'Your Google Health connection expired. Reconnect to keep your steps syncing.'

  return (
    <div className="mx-4 mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4" role="status">
      <p className="text-sm text-amber-900">{message}</p>
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => navigate('/data-source-settings')}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reconnect
        </button>
        <button onClick={dismiss} className="text-sm text-amber-900 underline">
          Not now
        </button>
      </div>
    </div>
  )
}

export default ReconnectBanner
