import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { useLeaderboard } from '../hooks/useLeaderboard'
import Icon from './ui/Icon'

const fmt = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

// Points v2: today's points by category for the signed-in user. Today stays
// provisional until 48 hours after it ends (late syncs can still change it).
const V2TodayPoints = ({ challenge, onClick }) => {
  const { user } = useContext(UserContext)
  const { data } = useLeaderboard(challenge?._id)
  const row = Array.isArray(data) ? data.find((r) => r.userId === user?.sub && r.scoringMode === 'v2') : null
  if (!row) return null

  const t = row.today || {}
  const items = [
    { label: 'Steps', value: t.stepPoints, icon: 'steps' },
    { label: 'Goal bonus', value: t.goalBonusPoints, icon: 'target' },
    { label: 'Effort', value: t.effortPoints, icon: 'flame' },
    { label: 'Strength', value: t.strengthPoints, icon: 'dumbbell' },
  ]
  const provisional = row.today ? row.today.provisional !== false : true

  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-pad card-interactive block h-full w-full text-left"
      aria-label={`Today's points: ${fmt(t.total)}${provisional ? ', provisional' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon name="sparkles" className="h-5 w-5" />
        </span>
        <h2 className="flex-1 text-sm font-medium text-ink-muted">Today's points</h2>
        {provisional && <span className="chip chip-warning">Provisional</span>}
        <Icon name="chevron-right" className="h-4 w-4 text-ink-subtle" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-ink">{fmt(t.total)}</span>
        <span className="text-sm text-ink-muted">pts today</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(({ label, value, icon }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <Icon name={icon} className="h-4 w-4 shrink-0 text-brand-ink" />
            <div className="min-w-0">
              <dt className="truncate text-[11px] font-medium text-ink-muted">{label}</dt>
              <dd className="text-sm font-semibold text-ink">{fmt(value)}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-muted">
        Challenge total <span className="font-semibold text-ink">{fmt(row.totalPoints)}</span> pts
        {provisional && ' \u00b7 Today can still change as your data syncs.'}
      </p>
    </button>
  )
}

export default V2TodayPoints
