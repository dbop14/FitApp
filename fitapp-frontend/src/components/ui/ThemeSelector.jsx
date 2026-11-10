import { useTheme } from '../../context/ThemeContext'
import Icon from './Icon'

const OPTIONS = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

// Segmented Light / Dark / System control for the Settings page.
const ThemeSelector = () => {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {OPTIONS.map((o) => {
        const active = preference === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(o.value)}
            className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon name={o.icon} className="h-4 w-4" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default ThemeSelector
