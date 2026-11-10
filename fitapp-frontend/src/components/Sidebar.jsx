import { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChatNotifications } from '../context/ChatNotificationContext'
import Icon from './ui/Icon'
import Avatar from './ui/Avatar'
import ThemeToggle from './ui/ThemeToggle'
import fitappLogo from '../assets/fitapp-logo.svg'
import { PRIMARY_NAV, SECONDARY_NAV } from '../layout/navItems'

// Tablet / desktop navigation. Icon rail on md, full sidebar with labels on lg.
const Sidebar = () => {
  const { pathname } = useLocation()
  const { user } = useContext(UserContext)
  const { unreadCount } = useChatNotifications()

  const renderItem = (item) => {
    const active = item.isActive(pathname)
    const unread = item.path === '/chat' && unreadCount > 0
    return (
      <li key={item.path}>
        <Link
          to={item.path}
          className={`nav-link ${active ? 'active' : ''}`}
          aria-current={active ? 'page' : undefined}
          title={item.label}
        >
          <span className="relative">
            <Icon name={item.icon} className="h-5 w-5 shrink-0" strokeWidth={active ? 2 : 1.75} />
            {unread && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[rgb(var(--surface))]" />
            )}
          </span>
          <span className="nav-link-label">{item.label}</span>
          {unread && (
            <span className="ml-auto hidden rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white lg:inline">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-line bg-surface md:flex md:w-sidebar-rail lg:w-sidebar"
      aria-label="Sidebar"
    >
      <Link
        to="/dashboard"
        className="flex h-16 items-center gap-2.5 px-4 md:justify-center lg:justify-start lg:px-5"
        aria-label="FitApp home"
      >
        <img src={fitappLogo} alt="" className="h-9 w-9" />
        <span className="hidden text-lg font-bold tracking-tight text-ink lg:inline">FitApp</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        <ul className="space-y-1">{PRIMARY_NAV.map(renderItem)}</ul>
        <p className="section-title mb-2 mt-6 hidden px-3 lg:block">Activity</p>
        <div className="mx-3 my-4 border-t border-line lg:hidden" />
        <ul className="space-y-1">{SECONDARY_NAV.map(renderItem)}</ul>
      </nav>

      <div className="space-y-1 border-t border-line px-3 py-3">
        <ThemeToggle withLabel />
        {user && (
          <Link
            to="/account-settings"
            className={`nav-link ${pathname === '/account-settings' ? 'active' : ''}`}
            title="Account"
          >
            <Avatar src={user.picture} name={user.name} size="sm" />
            <span className="nav-link-label min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{user.name || 'Account'}</span>
              <span className="block text-xs text-ink-subtle">Account</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
