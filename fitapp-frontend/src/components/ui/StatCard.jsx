import React from 'react'
import Card from './Card'
import Icon from './Icon'

const LEGACY_ICONS = { steps: 'steps', weight: 'scale', rank: 'trophy' }

/**
 * StatCard: a single headline number with a label.
 * Props: title, value, subtitle, icon (Icon name) or legacy iconType,
 * variant ('surface' | 'brand'), tone (icon chip color: 'brand' | 'accent' | 'neutral'),
 * onClick, className, children (extra content under the value).
 */
const TONES = {
  brand: 'bg-brand-soft text-brand-ink',
  accent: 'bg-accent-soft text-accent-ink',
  neutral: 'bg-surface-2 text-ink-muted',
}

const StatCard = ({
  variant = 'surface',
  title,
  value,
  subtitle,
  icon,
  iconType,
  tone = 'brand',
  onClick,
  className = '',
  children,
}) => {
  const iconName = icon || LEGACY_ICONS[iconType]
  const brand = variant === 'brand' || variant === 'primary'
  return (
    <Card
      variant={brand ? 'brand' : 'surface'}
      onClick={onClick}
      ariaLabel={onClick ? `${title}${value ? `: ${value}` : ''}` : undefined}
      className={`flex flex-col ${className}`}
    >
      <div className="flex items-center gap-3">
        {iconName && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              brand ? 'bg-[rgb(255_255_255/0.16)] text-white' : TONES[tone] || TONES.brand
            }`}
          >
            <Icon name={iconName} className="h-5 w-5" />
          </span>
        )}
        <h3 className={`min-w-0 flex-1 text-sm font-medium ${brand ? 'text-blue-50' : 'text-ink-muted'}`}>{title}</h3>
        {onClick && (
          <Icon name="chevron-right" className={`h-4 w-4 shrink-0 ${brand ? 'text-blue-100' : 'text-ink-subtle'}`} />
        )}
      </div>
      {value !== undefined && value !== null && value !== '' && (
        <div className={`mt-3 text-3xl font-bold tracking-tight ${brand ? 'text-white' : 'text-ink'}`}>{value}</div>
      )}
      {subtitle && (
        <p className={`mt-1 truncate text-sm ${brand ? 'text-blue-100' : 'text-ink-muted'}`}>{subtitle}</p>
      )}
      {children}
    </Card>
  )
}

export default StatCard
