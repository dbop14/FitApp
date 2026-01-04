import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop Component
 * Scrolls to top of page on route change, except for Chat page
 */
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    // Don't scroll to top for Chat page - it handles its own scrolling
    if (pathname !== '/chat') {
      window.scrollTo(0, 0)
    }
  }, [pathname])

  return null
}

export default ScrollToTop

