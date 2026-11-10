import { Link } from 'react-router-dom'
import Icon from './Icon'

// One navigable row in a settings list.
const SettingsRow = ({ to, onClick, icon, title, description, tone = 'brand', trailing }) => {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    accent: 'bg-accent-soft text-accent-ink',
    neutral: 'bg-surface-2 text-ink-muted',
    danger: 'bg-red-50 text-red-600',
  }
  const inner = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.brand}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-ink'}`}>{title}</span>
        {description && <span className="block truncate text-sm text-ink-muted">{description}</span>}
      </span>
      {trailing ?? <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-subtle" />}
    </>
  )
  const cls = 'list-row w-full text-left transition-colors hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2'
  if (to) {
    return (
      <Link to={to} className={`${cls} font-normal`}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export default SettingsRow
