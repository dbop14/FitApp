import { useTheme } from '../../context/ThemeContext'
import Icon from './Icon'

// Quick light/dark switch for the header and sidebar.
// `variant="brand"` is for use on the blue gradient header.
const ThemeToggle = ({ variant = 'default', withLabel = false, className = '' }) => {
  const { resolved, cycle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} mode`

  if (withLabel) {
    return (
      <button type="button" onClick={cycle} className={`nav-link w-full ${className}`} aria-label={label} title={label}>
        <Icon name={resolved === 'dark' ? 'sun' : 'moon'} className="h-5 w-5 shrink-0" />
        <span className="nav-link-label">{resolved === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={`${variant === 'brand' ? 'icon-btn-on-brand' : 'icon-btn'} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
    </button>
  )
}

export default ThemeToggle
