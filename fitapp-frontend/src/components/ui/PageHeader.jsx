import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import ThemeToggle from './ThemeToggle'

/**
 * Sticky page header on the brand gradient (from-blue-500 to-blue-800).
 * Sits inside the app shell content column, so it never covers the sidebar.
 *
 * Props:
 *  - title, subtitle
 *  - back: path string, or true for history back, or a function
 *  - actions: right-side buttons (use className "icon-btn-on-brand" or "btn btn-sm btn-on-brand")
 *  - children: optional extra row below the title (tabs, filters)
 *  - themeToggle: show the light/dark switch on phones (the sidebar has it on larger screens)
 */
const PageHeader = ({ title, subtitle, back, actions, children, themeToggle = true, className = '' }) => {
  const navigate = useNavigate()

  const onBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }

  return (
    <header
      className={`sticky top-0 z-40 bg-gradient-to-r from-blue-500 to-blue-800 text-white shadow-brand safe-area-header ${className}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 pb-3 sm:px-6 lg:px-8">
        {back && (
          <button type="button" onClick={onBack} className="icon-btn-on-brand -ml-1" aria-label="Go back">
            <Icon name="chevron-left" className="h-6 w-6" />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${back ? '' : 'pl-1 sm:pl-0'}`}>
          <h1 className="truncate text-lg font-bold leading-tight text-white sm:text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs font-medium text-blue-100 sm:text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        {themeToggle && <ThemeToggle variant="brand" className="md:hidden" />}
      </div>
      {children && <div className="mx-auto w-full max-w-6xl px-3 pb-3 sm:px-6 lg:px-8">{children}</div>}
    </header>
  )
}

export default PageHeader
