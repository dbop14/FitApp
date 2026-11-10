import React from 'react'
import Card from './Card'
import Icon from './Icon'

/**
 * ProgressCard: steps toward the daily goal, on the brand gradient.
 * Props: title, current, goal, subtitle, achieved, showPointStatus, onClick, className.
 * Scoring values are not shown here; they come from the backend elsewhere.
 */
const ProgressCard = ({
  title = 'Steps today',
  current = 0,
  goal,
  subtitle,
  achieved = false,
  showPointStatus = false,
  onClick,
  className = '',
}) => {
  const safeCurrent = typeof current === 'number' && !isNaN(current) ? current : 0
  const safeGoal = typeof goal === 'number' && !isNaN(goal) && goal > 0 ? goal : 0
  const percentage = safeGoal ? Math.min((safeCurrent / safeGoal) * 100, 100) : 0
  const remaining = Math.max(safeGoal - safeCurrent, 0)

  return (
    <Card
      variant="brand"
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      ariaLabel={onClick ? `${title}: ${safeCurrent.toLocaleString()} of ${safeGoal.toLocaleString()}` : undefined}
    >
      <Icon
        name="steps"
        className="pointer-events-none absolute -right-6 -top-4 h-36 w-36 text-white opacity-[0.08]"
        strokeWidth={1.25}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-50">
          <Icon name="steps" className="h-4 w-4" />
          <span className="flex-1">{title}</span>
          {onClick && <Icon name="chevron-right" className="h-4 w-4 text-blue-100" />}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{safeCurrent.toLocaleString()}</span>
          {safeGoal > 0 && <span className="pb-1.5 text-sm font-medium text-blue-100">/ {safeGoal.toLocaleString()}</span>}
        </div>
        {subtitle && <p className="mt-1 text-sm text-blue-100">{subtitle}</p>}

        {safeGoal > 0 && (
          <>
            <div
              className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.2)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(percentage)}
            >
              <div className="h-full rounded-full bg-[#fff] transition-[width] duration-500" style={{ width: `${percentage}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-medium text-blue-100">
              <span>{Math.floor(percentage)}% of goal</span>
              <span>{remaining > 0 ? `${remaining.toLocaleString()} to go` : 'Goal reached'}</span>
            </div>
          </>
        )}

        {showPointStatus && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[rgb(255_255_255/0.12)] px-3 py-2 text-sm text-white">
            <Icon name={achieved ? 'check-circle' : 'target'} className="h-4 w-4 shrink-0" />
            <span>{achieved ? 'Goal reached. Step point earned today.' : 'Reach your goal to earn today’s step point.'}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ProgressCard
