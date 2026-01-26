import { useNavigate } from 'react-router-dom'
import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../context/UserContext'
import GoogleLoginButton from '../components/GoogleLoginButton'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import InfoBox from '../components/ui/InfoBox'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import fitappLogo from '../assets/fitapp-logo.svg'

/**
 * AuthPage Component - Refactored to align with unified design system
 * 
 * Design System Implementation:
 * - Layout: Follows design system container and spacing patterns
 * - Components: Uses design system components for consistency
 * - Styling: Applies design system color palette and typography
 * 
 * API Integration Preserved:
 * - Google authentication flow
 * - User login and redirect logic
 * - Session management
 */

const AuthPage = () => {
  const { login, user } = useContext(UserContext)
  const navigate = useNavigate()
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      console.log('User already logged in, redirecting to dashboard')
      // Clear any hash fragments and redirect to dashboard
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  // Clear hash fragments on component mount to prevent redirect loops
  useEffect(() => {
    if (window.location.hash) {
      console.log('Clearing hash fragment to prevent redirect loops')
      window.history.replaceState(null, null, window.location.pathname)
    }
  }, [])

  // Check localStorage for existing valid session
  useEffect(() => {
    const storedUser = localStorage.getItem('fitapp_user')
    const lastLoginTime = localStorage.getItem('fitapp_last_login')
    
    if (storedUser) {
      if (lastLoginTime) {
        // Check if session is still valid (30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        if (parseInt(lastLoginTime) > thirtyDaysAgo) {
          console.log('Valid session found in localStorage, redirecting to dashboard')
          navigate('/dashboard', { replace: true })
        } else {
          console.log('Session expired, clearing data and staying on login page')
          localStorage.removeItem('fitapp_user')
          localStorage.removeItem('fitapp_access_token')
          localStorage.removeItem('fitapp_access_token_expiry')
          localStorage.removeItem('fitapp_jwt_token')
          localStorage.removeItem('fitapp_jwt_expiry')
          localStorage.removeItem('fitapp_last_login')
        }
      } else {
        // User data exists but no lastLoginTime - set it now for backward compatibility
        // This allows the UserContext to handle the session properly
        console.log('User data found but no lastLoginTime, setting it now and redirecting to dashboard')
        localStorage.setItem('fitapp_last_login', Date.now().toString())
        navigate('/dashboard', { replace: true })
      }
    }
  }, [navigate])

  // ADDITIONAL SAFEGUARD: Prevent multiple redirects
  const [hasRedirected, setHasRedirected] = useState(false)
  
  useEffect(() => {
    if (user && !hasRedirected) {
      console.log('SAFEGUARD: User logged in, setting redirect flag and navigating')
      setHasRedirected(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 100)
    }
  }, [user, hasRedirected, navigate])

  const handleCompleteLogin = async (userData, accessToken, expiresIn, jwtToken) => {
    setIsAuthenticating(true)
    try {
      console.log('Processing complete authentication from GoogleLoginButton...')
      
      // Calculate expiry time if provided
      let expiryTime = null
      if (expiresIn) {
        expiryTime = Date.now() + (expiresIn * 1000)
      }
      
      // Complete login with all data
      login(userData, accessToken, expiryTime)
      
      // Store JWT token if provided
      if (jwtToken) {
        localStorage.setItem('fitapp_jwt_token', jwtToken)
        localStorage.setItem('fitapp_jwt_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString())
        console.log('JWT token stored for API authentication')
      }
      
      console.log('Complete authentication successful, redirecting to dashboard')
      navigate('/dashboard')
      
    } catch (error) {
      console.error('Authentication flow failed:', error)
      navigate('/dashboard')
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6" style={{ 
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)'
    }}>
      <div className="max-w-md w-full">
        {/* Auth Container */}
        <div className="bg-blue-50 rounded-3xl shadow-2xl p-8 text-center">
          
          {/* Header */}
          <div className="mb-8">
            <div className="mx-auto mb-6" style={{ width: '81.2px', height: '81.2px' }}>
              <img 
                src={fitappLogo} 
                alt="FitApp Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            
            <h1 className={unifiedDesignSystem.typography.hierarchy.appTitle + " text-blue-600 mb-3"}>
              FitApp
            </h1>
            
            <p className="text-gray-600 text-lg">
              Join fitness challenges and track your progress with friends
            </p>
          </div>

          {/* Authentication Section */}
          <div className="flex justify-center">
            {isAuthenticating ? (
              <div className="text-center">
                <LoadingSpinner />
              </div>
            ) : (
              <GoogleLoginButton onComplete={handleCompleteLogin} />
            )}
          </div>

          {/* Terms and Privacy Notice */}
          <div className="mt-6 text-xs text-gray-600 text-center">
            <p>
              By signing in, you agree to our{' '}
              <a 
                href="/terms-of-service" 
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a 
                href="/privacy-policy" 
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage