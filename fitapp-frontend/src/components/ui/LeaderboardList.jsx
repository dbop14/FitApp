import React, { useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'

// Points v2 shows tenths; Classic points are whole numbers.
const formatPoints = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

const V2_CATEGORIES = [
  { key: 'steps', label: 'Steps', icon: 'steps' },
  { key: 'goalBonus', label: 'Daily goal bonus', icon: 'target' },
  { key: 'effort', label: 'Effort', icon: 'flame' },
  { key: 'strength', label: 'Strength', icon: 'dumbbell' },
  { key: 'weekly', label: 'Weekly bonus', icon: 'calendar-check' },
  { key: 'weightLoss', label: 'Weight loss', icon: 'trending-down' },
]

// Top-three rank badges: gold, silver, bronze tones on the medal icon.
const RANK_BADGE = {
  1: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300',
  2: 'bg-surface-3 text-ink-muted ring-1 ring-inset ring-line-strong',
  3: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-300',
}

// Expanded detail for a Points v2 row: totals by category, plus today's points.
const V2Breakdown = ({ participant }) => {
  const b = participant.breakdown || {}
  const t = participant.today
  const todayTotal = t ? t.total ?? ((t.stepPoints || 0) + (t.goalBonusPoints || 0) + (t.effortPoints || 0) + (t.strengthPoints || 0)) : null
  const weeksEarned = (participant.weeks || []).filter((w) => w.points > 0).length
  return (
    <div className="mt-3 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
      <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2 sm:gap-x-6">
        {V2_CATEGORIES.map(({ key, label, icon }) => (
          <div key={key} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
            <Icon name={icon} className="h-4 w-4 shrink-0 text-brand-ink" />
            <dt className="flex-1 text-ink-muted">{label}</dt>
            <dd className="font-semibold tabular-nums text-ink">{formatPoints(b[key])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {todayTotal !== null && (
          <span className="inline-flex items-center gap-1">
            Today: <span className="font-semibold text-ink">{formatPoints(todayTotal)} pts</span>
            {t?.provisional && <span className="chip chip-warning">Provisional</span>}
          </span>
        )}
        <span>
          Weekly bonus earned {weeksEarned} {weeksEarned === 1 ? 'week' : 'weeks'}.
        </span>
      </p>
    </div>
  )
}

const LeaderboardList = ({ participants, currentUserId, onCardTap }) => {
  const allParticipants = participants
  const [expandedId, setExpandedId] = useState(null)

  // v2 rows expand to show the breakdown
  const handleCardTap = (participant) => {
    if (participant.scoringMode === 'v2') {
      setExpandedId((id) => (id === participant.id ? null : participant.id))
    }
    if (onCardTap) onCardTap(participant)
  }

  const handleKeyDown = (e, participant) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardTap(participant)
    }
  }

  if (allParticipants.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No participants to display</p>
  }

  return (
    <section className="card overflow-hidden" aria-label="Leaderboard">
      <ol className="list-divided">
        {allParticipants.map((participant, index) => {
          const rank = index + 1
          const isCurrentUser = participant.id === currentUserId
          const isV2 = participant.scoringMode === 'v2'
          const isExpanded = isV2 && expandedId === participant.id
          const points = isV2 ? formatPoints(participant.totalPoints) : participant.totalPoints || 0

          return (
            <li
              key={participant.id}
              className={`cursor-pointer px-4 py-3 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2 sm:px-5 ${
                isCurrentUser ? 'bg-brand-soft hover:bg-brand-soft' : ''
              }`}
              onClick={() => handleCardTap(participant)}
              onKeyDown={(e) => handleKeyDown(e, participant)}
              role="button"
              tabIndex={0}
              aria-expanded={isV2 ? isExpanded : undefined}
              aria-label={`${participant.name} - Rank ${rank} - ${points} points${isV2 ? ' - tap for breakdown' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                    RANK_BADGE[rank] || 'text-ink-subtle'
                  }`}
                  aria-hidden="true"
                >
                  {rank <= 3 ? <Icon name="medal" className="h-4 w-4" strokeWidth={2} /> : rank}
                </span>

                <Avatar src={participant.avatar} name={participant.name} size="md" />

                {/* Name and stats */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate font-semibold ${isCurrentUser ? 'text-brand-ink' : 'text-ink'}`}>
                      {participant.name ? participant.name.split(' ')[0] : 'Unknown'}
                    </span>
                    {isCurrentUser && <span className="chip chip-brand">You</span>}
                    {rank <= 3 && <span className="sr-only">Rank {rank}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                    {isV2 && participant.breakdown && (
                      <span>
                        Steps {formatPoints(participant.breakdown.steps)} · Effort {formatPoints(participant.breakdown.effort)} · Bonus{' '}
                        {formatPoints((participant.breakdown.goalBonus || 0) + (participant.breakdown.weekly || 0))}
                      </span>
                    )}
                    {!isV2 && participant.stepGoalPoints !== undefined && <span>Step points: {participant.stepGoalPoints}</span>}
                    {participant.weightLossPercentage !== null && participant.weightLossPercentage !== undefined && (
                      <span>Weight loss: {participant.weightLossPercentage.toFixed(1)}%</span>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="flex shrink-0 items-center gap-1 text-right">
                  <div>
                    <div className="text-lg font-bold tabular-nums text-ink">{points}</div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">pts</div>
                  </div>
                  {isV2 && (
                    <Icon
                      name="chevron-down"
                      className={`h-4 w-4 text-ink-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  )}
                </div>
              </div>
              {isExpanded && <V2Breakdown participant={participant} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default LeaderboardList
