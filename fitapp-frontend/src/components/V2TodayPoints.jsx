import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { useLeaderboard } from '../hooks/useLeaderboard'

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
    { label: 'Steps', value: t.stepPoints },
    { label: 'Goal bonus', value: t.goalBonusPoints },
    { label: 'Effort', value: t.effortPoints },
    { label: 'Strength', value: t.strengthPoints },
  ]
  const provisional = row.today ? row.today.provisional !== false : true

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-200 p-4"
      aria-label={`Today's points: ${fmt(t.total)}${provisional ? ', provisional' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Today's points</h2>
        {provisional && (
          <span className="text-[11px] font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">Provisional</span>
        )}
      </div>
      <div className="mt-1 text-3xl font-bold text-gray-900">{fmt(t.total)}</div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {items.map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-50 py-2">
            <dt className="text-[11px] text-gray-500">{label}</dt>
            <dd className="text-sm font-semibold text-gray-900">{fmt(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-gray-500">
        Challenge total {fmt(row.totalPoints)} pts
        {provisional && ' · Today can still change as your data syncs.'}
      </p>
    </button>
  )
}

export default V2TodayPoints
