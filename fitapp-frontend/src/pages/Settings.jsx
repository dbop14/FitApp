import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import UserCard from '../components/ui/UserCard'
import Button from '../components/ui/Button'

/**
 * Settings Component - Refactored to align with unified design system
 * 
 * Design System Implementation:
 * - Layout: Follows designSystem.layoutPatterns.settings structure
 * - Components: Uses design system components for consistency
 * - Styling: Applies design system color palette and typography
 * 
 * API Integration Preserved:
 * - User context and logout functionality
 * - User profile display
 */

const Settings = () => {
  const { user, logout } = useContext(UserContext)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          {/* Page header - designSystem.layout.pageHeader.withActions */}
          <div className={unifiedDesignSystem.components.layout.pageHeader.withActions.className}>
            <h1 className={unifiedDesignSystem.typography.hierarchy.pageTitle}>
              Settings
            </h1>
          </div>
        
        {/* User profile card - designSystem.layoutPatterns.settings.profileDisplay */}
        <UserCard
          name={user?.name}
          picture={user?.picture}
          message="Manage your account settings"
        />

        {/* Settings options - designSystem.layoutPatterns.settings.optionCards */}
        <div className="space-y-4">
          {/* Account Settings */}
          <button
            onClick={() => navigate('/account-settings')}
            className="w-full bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-shadow duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-gray-600">
                  <svg width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Account Settings</h3>
                  <p className="text-sm text-gray-600">Manage your profile and preferences</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>

          {/* Data Source */}
          <button
            onClick={() => navigate('/data-source-settings')}
            className="w-full bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-shadow duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-gray-600">
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7.05025 1.53553C8.03344 0.552348 9.36692 0 10.7574 0C13.6528 0 16 2.34721 16 5.24264C16 6.63308 15.4477 7.96656 14.4645 8.94975L12.4142 11L11 9.58579L13.0503 7.53553C13.6584 6.92742 14 6.10264 14 5.24264C14 3.45178 12.5482 2 10.7574 2C9.89736 2 9.07258 2.34163 8.46447 2.94975L6.41421 5L5 3.58579L7.05025 1.53553Z" />
                    <path d="M7.53553 13.0503L9.58579 11L11 12.4142L8.94975 14.4645C7.96656 15.4477 6.63308 16 5.24264 16C2.34721 16 0 13.6528 0 10.7574C0 9.36693 0.552347 8.03344 1.53553 7.05025L3.58579 5L5 6.41421L2.94975 8.46447C2.34163 9.07258 2 9.89736 2 10.7574C2 12.5482 3.45178 14 5.24264 14C6.10264 14 6.92742 13.6584 7.53553 13.0503Z" />
                    <path d="M5.70711 11.7071L11.7071 5.70711L10.2929 4.29289L4.29289 10.2929L5.70711 11.7071Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Data Source</h3>
                  <p className="text-sm text-gray-600">
                    {user?.dataSource === 'fitbit' ? 'Fitbit' : 'Google Fit'}
                  </p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="w-full bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-shadow duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-gray-600">
                  <svg width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  <p className="text-sm text-gray-600">Manage your notification preferences</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>
        </div>

        {/* Logout button */}
        <div className="mt-8">
          <Button
            variant="secondary"
            onClick={handleLogout}
            size="lg"
            className="w-full"
          >
            Logout
          </Button>
        </div>
      </main>
      </div>
    </>
  )
}

export default Settings
