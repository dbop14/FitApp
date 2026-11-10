import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import ThemeToggle from './ThemeToggle'

/**
 * Page header on the brand gradient (from-blue-500 to-blue-800).
 *
 * It is position: fixed (not sticky) on purpose: iOS blurs page content that
 * scrolls under the status bar, and a sticky header counts as page content,
 * so its title got blurred. A spacer of the same height keeps the layout.
 * From md up it starts right of the sidebar.
 *
 * Props:
 *  - title, subtitle
 *  - back: path string, or true for history back, or a function
 *  - actions: right-side buttons (use className "icon-btn-on-brand" or "btn btn-sm btn-on-brand")
 *  - children: optional extra row below the title (tabs, filters)
 *  - themeToggle: show the light/dark switch on phones (the sidebar has it on larger screens)
 *  - fullWidth: start at the left edge on all sizes (pages without the sidebar)
 */
const PageHeader = ({ title, subtitle, back, actions, children, themeToggle = true, fullWidth = false, className = '' }) => {
  const navigate = useNavigate()
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => setHeight(el.offsetHeight)
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }

  return (
    <>
      <header
        ref={ref}
        className={`fixed inset-x-0 top-0 z-40 bg-gradient-to-r from-blue-500 to-blue-800 text-white shadow-brand safe-area-header ${
          fullWidth ? '' : 'md:left-sidebar-rail lg:left-sidebar'
        } ${className}`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 pb-3 sm:px-6 lg:px-8">
          {back && (
            <button type="button" onClick={onBack} className="icon-btn-on-brand -ml-1" aria-label="Go back">
              <Icon name="chevron-left" className="h-6 w-6" />
            </button>
          )}
          <div className={`min-w-0 flex-1 ${back ? '' : 'pl-1 sm:pl-0'}`}>
            <h1 className="line-clamp-2 break-words text-lg font-bold leading-tight text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="truncate text-xs font-medium text-blue-100 sm:text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          {themeToggle && <ThemeToggle variant="brand" className="md:hidden" />}
        </div>
        {children && <div className="mx-auto w-full max-w-6xl px-3 pb-3 sm:px-6 lg:px-8">{children}</div>}
      </header>
      {/* Reserve the header's height in the page flow */}
      <div aria-hidden="true" style={{ height }} className={height ? '' : 'h-[calc(4rem+var(--safe-area-top))]'} />
    </>
  )
}

export default PageHeader
