import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../utils/constants';
import { designSystem, componentStyles } from '../config/designSystem';

const GoogleLoginButton = ({ onComplete }) => {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)

  useEffect(() => {
    // Check if Google Identity Services is loaded
    const checkGoogleServices = () => {
      console.log('🔍 Checking Google Services:', {
        hasGoogle: !!window.google,
        hasAccounts: !!(window.google && window.google.accounts),
        googleObject: window.google
      })
      
      if (window.google && window.google.accounts) {
        console.log('✅ Google Identity Services loaded successfully')
        setIsGoogleLoaded(true)
        return true
      }
      return false
    }

    if (!checkGoogleServices()) {
      console.log('⏳ Google Services not loaded yet, waiting...')
      // Wait for Google Services to load
      const interval = setInterval(() => {
        if (checkGoogleServices()) {
          console.log('✅ Google Services loaded, clearing interval')
          clearInterval(interval)
        }
      }, 100)

      // Cleanup after 10 seconds
      setTimeout(() => {
        clearInterval(interval)
        if (!isGoogleLoaded) {
          console.error('❌ Google Services failed to load after 10 seconds')
        }
      }, 10000)
    }
  }, [isGoogleLoaded])

  const getJWTToken = async (userData) => {
    try {
      console.log('🔑 Getting JWT token and saving user data...');
      
      const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
              const response = await fetch(`${apiUrl}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: userData.sub,
          name: userData.name,
          email: userData.email,
          picture: userData.picture
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ JWT token received and user data saved');
        
        // Store the JWT token
        localStorage.setItem('fitapp_jwt_token', result.token);
        localStorage.setItem('fitapp_jwt_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
        
        // Convert database user format to frontend format (sub instead of googleId)
        const dbUserData = {
          sub: result.user.googleId,
          name: result.user.name,
          email: result.user.email,
          picture: result.user.picture,
          steps: result.user.steps,
          weight: result.user.weight,
          lastSync: result.user.lastSync
        };
        
        // Store the user data (from database, which includes custom picture/name) in frontend format
        localStorage.setItem('fitapp_user', JSON.stringify(dbUserData));
        
        // Return both token and user data (user data from DB has custom picture/name)
        return { token: result.token, user: dbUserData };
      } else {
        const error = await response.json();
        console.error('❌ Failed to get JWT token:', error);
        return null;
      }
    } catch (err) {
      console.error('❌ Error getting JWT token:', err);
      return null;
    }
  };

  const handleGoogleLogin = () => {
    // Use backend OAuth2 flow instead of Google Identity Services
    // This allows us to get refresh tokens for 30-day authentication
    const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
    const oauthUrl = `${apiUrl}/api/auth/google`;
    
    console.log('🔐 Starting backend OAuth2 flow...');
    console.log('🔄 Redirecting to:', oauthUrl);
    
    // Redirect to backend OAuth endpoint
    // Backend will redirect to Google, then back to /api/auth/google/callback,
    // which will then redirect to frontend /auth/callback with JWT token
    window.location.href = oauthUrl;
  };

  if (!isGoogleLoaded) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Apply design system styles from JSON specification
  const buttonStyles = {
    height: componentStyles.socialAuthButton.button_style.height,
    borderRadius: componentStyles.socialAuthButton.button_style.borderRadius,
    border: componentStyles.socialAuthButton.button_style.border,
    background: componentStyles.socialAuthButton.button_style.background,
    color: '#000000', // Black text color
    fontWeight: componentStyles.socialAuthButton.button_style.fontWeight,
    padding: designSystem.spacing.component.button_internal_padding,
    transition: designSystem.transitions.default,
    boxShadow: designSystem.shadows.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '320px'
  }

  return (
    <button
      onClick={handleGoogleLogin}
      style={buttonStyles}
      className="hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      aria-label="Continue with Google"
    >
      {/* Google Icon - positioned left as per JSON spec */}
      <svg 
        className="mr-2" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24"
        style={{ marginRight: componentStyles.socialAuthButton.button_style.icon_spacing }}
      >
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      
      {/* Button text - using design system typography */}
      <span style={{
        fontSize: designSystem.typography.hierarchy.button_text.size,
        fontWeight: designSystem.typography.hierarchy.button_text.weight,
        lineHeight: designSystem.typography.hierarchy.button_text.lineHeight
      }}>
        Continue with Google
      </span>
    </button>
  )
}

export default GoogleLoginButton
