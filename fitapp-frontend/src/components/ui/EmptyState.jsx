import React from 'react'
import Icon from './Icon'

// Centered empty / zero-data state inside a card.
const EmptyState = ({ icon = 'info', title, children, action, className = '' }) => (
  <div className={`card card-pad flex flex-col items-center px-6 py-10 text-center ${className}`}>
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
      <Icon name={icon} className="h-7 w-7" />
    </span>
    {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
    {children && <div className="mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export default EmptyState
