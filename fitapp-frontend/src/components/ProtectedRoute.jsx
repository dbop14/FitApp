import { useContext, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'

const ProtectedRoute = ({ children }) => {
  const contextValue = useContext(UserContext)
  const [hasChecked, setHasChecked] = useState(false)
  
  // Handle case when context is null (during initial render)
  if (!contextValue) {
    // Check localStorage directly if context isn't available yet
    const storedUser = localStorage.getItem('fitapp_user')
    const lastLoginTime = localStorage.getItem('fitapp_last_login')
    
    if (storedUser) {
      if (lastLoginTime) {
        // Check if session is still valid (30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        if (parseInt(lastLoginTime) > thirtyDaysAgo) {
          console.log('🔒 ProtectedRoute: Valid user found in localStorage, allowing access')
          return children
        } else {
          console.log('🔒 ProtectedRoute: Session expired, clearing data and redirecting to login')
          localStorage.removeItem('fitapp_user')
          localStorage.removeItem('fitapp_access_token')
          localStorage.removeItem('fitapp_access_token_expiry')
          localStorage.removeItem('fitapp_jwt_token')
          localStorage.removeItem('fitapp_jwt_expiry')
          localStorage.removeItem('fitapp_last_login')
          return <Navigate to="/login" replace />
        }
      } else {
        // User data exists but no lastLoginTime - set it now for backward compatibility
        // This allows the UserContext to handle the session properly
        console.log('🔒 ProtectedRoute: User data found but no lastLoginTime, setting it now')
        localStorage.setItem('fitapp_last_login', Date.now().toString())
        return children
      }
    } else {
      console.log('🔒 ProtectedRoute: No user in localStorage, redirecting to login')
      return <Navigate to="/login" replace />
    }
  }
  
  const { user, isInitializing } = contextValue
  const isLoggedIn = user || localStorage.getItem('fitapp_user')

  // ADDITIONAL SAFEGUARD: Prevent redirect loops
  useEffect(() => {
    if (!hasChecked) {
      console.log('🔒 ProtectedRoute: Setting checked flag')
      setHasChecked(true)
    }
  }, [hasChecked])

  // Show loading while initializing
  if (isInitializing) {
    console.log('🔒 ProtectedRoute: Context still initializing, showing loading')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isLoggedIn) {
    console.log('🔒 ProtectedRoute: User authenticated, allowing access')
    return children
  } else if (hasChecked) {
    console.log('🔒 ProtectedRoute: User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  } else {
    console.log('🔒 ProtectedRoute: Waiting for initial check to complete')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }
}

export default ProtectedRoute
