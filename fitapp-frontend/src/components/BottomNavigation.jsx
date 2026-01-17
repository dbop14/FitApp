import { Link, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { useChatNotifications } from '../context/ChatNotificationContext'

const BottomNavigation = () => {
  const location = useLocation()
  const { user } = useContext(UserContext)
  const { unreadCount } = useChatNotifications()
  // SVG Icons for navigation
  const DashboardIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
    </svg>
  )

  const ChallengeIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M16.5,18.75c1.66,0,3,1.34,3,3H4.5c0-1.66,1.34-3,3-3h9Z"/>
      <path d="M15.38,14.25c.62,0,1.12.5,1.12,1.13v3.37H7.5v-3.37c0-.63.5-1.13,1.13-1.13h6.75Z"/>
      <path d="M13.52,11.08c.09,1.15.44,2.22.98,3.17h-5c.54-.95.89-2.02.98-3.17.49.11,1,.17,1.52.17s1.03-.06,1.52-.17Z"/>
      <path d="M18.75,4.24c.98.14,1.95.31,2.92.52-.45,2.66-2.66,4.73-5.4,4.97,1.51-1.24,2.48-3.12,2.48-5.23v-.26Z"/>
      <path d="M5.25,4.5c0,2.11.97,3.99,2.48,5.23-2.73-.24-4.95-2.31-5.4-4.97.97-.21,1.94-.38,2.92-.52v.26Z"/>
      <path d="M18.75,4.24v.26c0,2.11-.97,3.99-2.48,5.23-.79.64-1.72,1.11-2.75,1.35-.49.11-1,.17-1.52.17s-1.03-.06-1.52-.17c-1.03-.24-1.96-.71-2.75-1.35-1.51-1.24-2.48-3.12-2.48-5.23v-1.78c2.21-.31,4.46-.47,6.75-.47s4.54.16,6.75.47v1.52Z"/>
    </svg>
  )

  const ChatIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  )

  const SettingsIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )

  const navigationItems = [
    { path: '/dashboard', icon: DashboardIcon, label: 'Dashboard', active: location.pathname === '/dashboard' },
    { path: '/challenges', icon: ChallengeIcon, label: 'Challenges', active: location.pathname === '/challenges' },
    { path: '/chat', icon: ChatIcon, label: 'Chat', active: location.pathname === '/chat' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings', active: location.pathname.startsWith('/settings') || location.pathname === '/account-settings' }
  ]

  return (
    <div className="bottom-navigation">
      {/* Main Navigation Items */}
      <nav className="bottom-nav">
        {navigationItems.map((item) => {
          const IconComponent = item.icon
          const hasUnreadChats = item.path === '/chat' && unreadCount > 0
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${item.active ? 'active' : ''}`}
            >
              <span className="nav-icon relative">
                <IconComponent className="w-6 h-6" />
                {hasUnreadChats && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default BottomNavigation 