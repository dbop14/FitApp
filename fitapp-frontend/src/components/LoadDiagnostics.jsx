import { useEffect, useState } from 'react'

// Dev-site only: shows recent page loads recorded by main.jsx, to diagnose
// reload/flicker reports on phones where there is no console.
const read = () => {
  try {
    return JSON.parse(localStorage.getItem('fitapp_load_log') || '[]')
  } catch {
    return []
  }
}

const LoadDiagnostics = () => {
  const [log, setLog] = useState(read)
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setLog(read())
      tick((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (typeof window === 'undefined' || !/fitappdev|localhost/.test(window.location.hostname)) return null

  const now = Date.now()
  const lastMinute = log.filter((e) => now - e.t < 60000).length
  const recent = log.slice(-6).reverse()

  return (
    <section aria-labelledby="settings-diag">
      <h2 id="settings-diag" className="section-title mb-2 px-1">Diagnostics (dev only)</h2>
      <div className="card card-pad space-y-2 text-sm">
        <p className="text-ink">
          Page loads in the last minute: <span className="font-bold">{lastMinute}</span>
        </p>
        <p className="text-ink-muted">
          Service worker: {navigator.serviceWorker?.controller ? 'active' : 'none'} · Standalone:{' '}
          {navigator.standalone === true ? 'yes' : 'no'}
        </p>
        <ul className="space-y-0.5 font-mono text-xs text-ink-muted">
          {recent.map((e) => (
            <li key={e.t}>
              {new Date(e.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })} · {e.type} · {e.reason}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            try {
              localStorage.removeItem('fitapp_load_log')
            } catch {
              // ignore
            }
            setLog([])
          }}
        >
          Clear
        </button>
      </div>
    </section>
  )
}

export default LoadDiagnostics
