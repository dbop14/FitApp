import React, { useContext } from 'react'
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
  // #region agent log
  React.useEffect(() => {
    if (user) {
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.jsx:22',message:'Settings component user data',data:{hasUser:!!user,userName:user?.name,userPicture:user?.picture?.substring(0,50),pictureLength:user?.picture?.length,isDataUrl:user?.picture?.startsWith('data:image')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
  }, [user]);
  // #endregion
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 pt-20">
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
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="inline mr-2">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293 2.293a1 1 0 001.414 1.414l4-4a1 1 0 000-1.414l-4-4a1 1 0 10-1.414 1.414L15.586 2H5a3 3 0 00-3 3z" clipRule="evenodd" />
            </svg>
            Logout
          </Button>
        </div>
      </main>
      </div>
    </>
  )
}

export default Settings
