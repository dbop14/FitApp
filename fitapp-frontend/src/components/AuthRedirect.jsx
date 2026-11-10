import { useContext, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'

/**
 * Component that redirects based on authentication status.
 * Used for catch-all routes to ensure proper navigation:
 * - Authenticated users → /dashboard
 * - Unauthenticated users → /login
 */
const AuthRedirect = () => {
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
          console.log('🔀 AuthRedirect: Valid user found, redirecting to dashboard')
          return <Navigate to="/dashboard" replace />
        } else {
          console.log('🔀 AuthRedirect: Session expired, redirecting to login')
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
        console.log('🔀 AuthRedirect: User data found but no lastLoginTime, setting it now and redirecting to dashboard')
        localStorage.setItem('fitapp_last_login', Date.now().toString())
        return <Navigate to="/dashboard" replace />
      }
    } else {
      console.log('🔀 AuthRedirect: No user in localStorage, redirecting to login')
      return <Navigate to="/login" replace />
    }
  }
  
  const { user, isInitializing } = contextValue
  const isLoggedIn = user || localStorage.getItem('fitapp_user')

  // ADDITIONAL SAFEGUARD: Prevent redirect loops
  useEffect(() => {
    if (!hasChecked) {
      console.log('🔀 AuthRedirect: Setting checked flag')
      setHasChecked(true)
    }
  }, [hasChecked])

  // Show loading while initializing
  if (isInitializing) {
    console.log('🔀 AuthRedirect: Context still initializing, showing loading')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <span className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  if (isLoggedIn) {
    console.log('🔀 AuthRedirect: User authenticated, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  } else if (hasChecked) {
    console.log('🔀 AuthRedirect: User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  } else {
    console.log('🔀 AuthRedirect: Waiting for initial check to complete')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <span className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }
}

export default AuthRedirect

