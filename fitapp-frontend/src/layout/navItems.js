// Shared navigation config for the phone bottom bar and the tablet/desktop sidebar.
export const PRIMARY_NAV = [
  {
    path: '/dashboard',
    icon: 'dashboard',
    label: 'Dashboard',
    isActive: (p) => p === '/dashboard',
  },
  {
    path: '/challenges',
    icon: 'trophy',
    label: 'Challenges',
    isActive: (p) => p === '/challenges' || p === '/completed-challenges',
  },
  {
    path: '/chat',
    icon: 'chat',
    label: 'Chat',
    isActive: (p) => p === '/chat',
  },
  {
    path: '/settings',
    icon: 'settings',
    label: 'Settings',
    isActive: (p) =>
      p.startsWith('/settings') ||
      p === '/account-settings' ||
      p === '/data-source-settings' ||
      p === '/notifications',
  },
]

// Extra shortcuts shown only in the sidebar (on phones they are reached from the dashboard).
export const SECONDARY_NAV = [
  { path: '/leaderboard', icon: 'medal', label: 'Leaderboard', isActive: (p) => p === '/leaderboard' },
  { path: '/steps-history', icon: 'steps', label: 'Steps history', isActive: (p) => p === '/steps-history' },
  { path: '/weight-history', icon: 'scale', label: 'Weight history', isActive: (p) => p === '/weight-history' },
]
