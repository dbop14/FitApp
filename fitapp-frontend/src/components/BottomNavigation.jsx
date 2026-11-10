import { Link, useLocation } from 'react-router-dom'
import { useChatNotifications } from '../context/ChatNotificationContext'
import Icon from './ui/Icon'
import { PRIMARY_NAV } from '../layout/navItems'

// Phone tab bar. Hidden from md up, where the sidebar takes over.
// The Chat page hides it while typing via the `chat-input-focused` class.
const BottomNavigation = () => {
  const { pathname } = useLocation()
  const { unreadCount } = useChatNotifications()

  return (
    <nav className="bottom-navigation md:hidden" aria-label="Main">
      <div className="mx-auto flex h-16 max-w-md items-stretch gap-1 px-2 py-1.5">
        {PRIMARY_NAV.map((item) => {
          const active = item.isActive(pathname)
          const unread = item.path === '/chat' && unreadCount > 0
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`tab-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-brand-soft' : ''
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                {unread && (
                  <span className="absolute right-2 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[rgb(var(--surface))]">
                    <span className="sr-only">Unread messages</span>
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation
