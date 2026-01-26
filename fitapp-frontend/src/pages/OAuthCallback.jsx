import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { getApiUrl } from '../utils/apiService'

/**
 * OAuthCallback Component
 * Handles the OAuth redirect from backend after Google authentication
 * Extracts JWT token from query parameters and completes the login process
 */
const OAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useContext(UserContext)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get token and user data from query parameters
        const token = searchParams.get('token')
        const errorParam = searchParams.get('error')
        const googleId = searchParams.get('googleId')
        const email = searchParams.get('email')
        
        if (errorParam) {
          console.error('❌ OAuth error:', errorParam)
          setError(errorParam)
          setTimeout(() => navigate('/login'), 3000)
          return
        }
        
        if (!token) {
          console.error('❌ No token in callback')
          setError('Authentication failed: No token received')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        if (!googleId) {
          console.error('❌ No googleId in callback')
          setError('Authentication failed: No user ID received')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        console.log('✅ OAuth callback received, processing authentication...')

        // Store JWT token
        localStorage.setItem('fitapp_jwt_token', token)
        localStorage.setItem('fitapp_jwt_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString())
        console.log('💾 JWT token stored')
        
        // Fetch user data from backend using the token
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/api/user/userdata?googleId=${googleId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch user data' }))
          throw new Error(errorData.error || 'Failed to fetch user data')
        }
        
        const userData = await response.json()
        console.log('✅ User data fetched from backend:', userData)
        
        // Convert to frontend format
        const frontendUserData = {
          sub: googleId,
          name: userData.name || email?.split('@')[0] || 'User',
          email: email || userData.email,
          picture: userData.picture || null,
          steps: userData.steps || 0,
          weight: userData.weight || null,
          lastSync: userData.lastSync || null,
          dataSource: userData.dataSource || 'google-fit' // Preserve data source preference
        }
        
        console.log('👤 Frontend user data prepared:', frontendUserData)
        
        // Complete login (no Google access token needed - backend handles it with refresh token)
        login(frontendUserData, null, null)
        console.log('✅ Login completed, redirecting to dashboard...')
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true })
        
      } catch (err) {
        console.error('❌ OAuth callback error:', err)
        setError(err.message || 'Authentication failed')
        setTimeout(() => navigate('/login'), 3000)
      } finally {
        setIsProcessing(false)
      }
    }

    processCallback()
  }, [searchParams, navigate, login])

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Completing authentication...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-semibold">Authentication Error</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
          <p className="text-gray-600 text-sm">Redirecting to login page...</p>
        </div>
      </div>
    )
  }

  return null
}

export default OAuthCallback

