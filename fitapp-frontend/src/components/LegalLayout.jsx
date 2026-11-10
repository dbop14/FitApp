import { useNavigate } from 'react-router-dom'
import Icon from './ui/Icon'
import ThemeToggle from './ui/ThemeToggle'

// Shell for public text pages (privacy policy, terms). No app navigation.
const LegalLayout = ({ title, lastUpdated, children }) => {
  const navigate = useNavigate()
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-500 to-blue-800 text-white shadow-brand safe-area-header">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 pb-3 sm:px-6">
          <button type="button" onClick={goBack} className="icon-btn-on-brand -ml-1" aria-label="Go back">
            <Icon name="chevron-left" className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-white sm:text-xl">{title}</h1>
            {lastUpdated && <p className="text-xs text-blue-100">Last updated {lastUpdated}</p>}
          </div>
          <ThemeToggle variant="brand" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 pb-[calc(2.5rem+var(--safe-area-bottom))] sm:px-6">
        <article className="card p-5 leading-relaxed text-ink sm:p-8 [&_a]:underline [&_code]:break-all [&_code]:text-[13px] [&_h2:first-child]:mt-0">
          {children}
        </article>
      </main>
    </div>
  )
}

export default LegalLayout
