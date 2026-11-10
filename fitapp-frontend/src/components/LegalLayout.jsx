import { useNavigate } from 'react-router-dom'
import PageHeader from './ui/PageHeader'
import ThemeToggle from './ui/ThemeToggle'

// Shell for public text pages (privacy policy, terms). No app navigation.
const LegalLayout = ({ title, lastUpdated, children }) => {
  const navigate = useNavigate()
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  return (
    <div className="min-h-screen bg-canvas">
      <PageHeader
        title={title}
        subtitle={lastUpdated ? `Last updated ${lastUpdated}` : undefined}
        back={goBack}
        fullWidth
        themeToggle={false}
        actions={<ThemeToggle variant="brand" />}
      />
      <main className="mx-auto max-w-4xl px-4 py-6 pb-[calc(2.5rem+var(--safe-area-bottom))] sm:px-6">
        <article className="card p-5 leading-relaxed text-ink sm:p-8 [&_a]:underline [&_code]:break-all [&_code]:text-[13px] [&_h2:first-child]:mt-0">
          {children}
        </article>
      </main>
    </div>
  )
}

export default LegalLayout
