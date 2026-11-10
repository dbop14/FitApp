import { useNavigate } from 'react-router-dom'
import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../context/UserContext'
import GoogleLoginButton from '../components/GoogleLoginButton'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'
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

  const FEATURES = [
    { icon: 'steps', text: 'Steps and workouts sync from Google Health or WHOOP' },
    { icon: 'trophy', text: 'Compete on a live leaderboard with friends' },
    { icon: 'chat', text: 'Group chat with a bot that cheers on your wins' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Brand panel */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-800 px-6 pb-16 pt-[calc(2.5rem+var(--safe-area-top))] text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgb(255_255_255/0.08)]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[rgb(255_255_255/0.06)]" />
        <div className="relative mx-auto max-w-md text-center lg:mx-0 lg:text-left">
          <div className="mx-auto mb-5 h-20 w-20 rounded-3xl bg-[#fff] p-3 shadow-brand lg:mx-0">
            <img src={fitappLogo} alt="FitApp logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">FitApp</h1>
          <p className="mt-2 text-base text-blue-100 sm:text-lg">Join fitness challenges and track your progress with friends.</p>
          <ul className="mt-8 hidden space-y-4 lg:block">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3 text-blue-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(255_255_255/0.14)]">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sign-in card */}
      <div className="relative z-10 -mt-10 flex flex-1 items-start justify-center px-4 pb-[calc(2rem+var(--safe-area-bottom))] lg:mt-0 lg:items-center lg:px-12">
        <div className="card w-full max-w-md p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold text-ink">Welcome</h2>
          <p className="mt-1 text-sm text-ink-muted">Sign in with your Google account to continue.</p>

          <div className="mt-6 flex justify-center">
            {isAuthenticating ? <LoadingSpinner /> : <GoogleLoginButton onComplete={handleCompleteLogin} />}
          </div>

          <ul className="mt-6 space-y-2 border-t border-line pt-5 text-left lg:hidden">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3 text-sm text-ink-muted">
                <Icon name={f.icon} className="h-4 w-4 shrink-0 text-brand-ink" />
                {f.text}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-xs text-ink-muted">
            By signing in, you agree to our{' '}
            <a href="/terms-of-service" className="underline" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            .
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            <a href="/home" className="underline">About FitApp</a>
            {' · '}
            <a href="/privacy-policy" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
