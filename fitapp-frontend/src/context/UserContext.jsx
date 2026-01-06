import { createContext, useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../utils/constants'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'

export const UserContext = createContext(null)

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [postLoginRefreshing, setPostLoginRefreshing] = useState(false)
  const [lastDataRefresh, setLastDataRefresh] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const userRef = useRef(null)
  const lastGoogleFitSync = useRef(null)
  const rateLimitedUntil = useRef(null)

          // Update ref whenever user changes
  useEffect(() => {
    userRef.current = user
  }, [user])

  // Save user to localStorage whenever it changes (including fitness data updates)
  useEffect(() => {
    if (user) {
      localStorage.setItem('fitapp_user', JSON.stringify(user))
    }
  }, [user])

  // Helper to check if token is expired
  // Use a 30-minute buffer to refresh proactively before actual expiry
  const isTokenExpired = () => {
    const expiry = localStorage.getItem('fitapp_access_token_expiry')
    if (!expiry) return true
    const bufferTime = 30 * 60 * 1000 // 30 minutes buffer
    return Date.now() > (parseInt(expiry, 10) - bufferTime)
  }

  // Helper to check if JWT token is expired
  const isJWTTokenExpired = () => {
    const jwtExpiry = localStorage.getItem('fitapp_jwt_expiry')
    if (!jwtExpiry) return true
    return Date.now() > parseInt(jwtExpiry, 10)
  }

  // Helper to check if user has valid Google Fit permissions
  const hasValidGoogleFitPermissions = () => {
    const token = localStorage.getItem('fitapp_access_token')
    const expiry = localStorage.getItem('fitapp_access_token_expiry')
    
    if (!token || !expiry) return false
    
    // Check if token is expired (with 30 minute buffer to match isTokenExpired)
    const bufferTime = 30 * 60 * 1000 // 30 minutes
    return Date.now() < (parseInt(expiry, 10) - bufferTime)
  }

  // Helper function to regenerate JWT token from backend
  const regenerateJWTToken = async (userData) => {
    try {
      console.log('🔑 Regenerating JWT token for existing session...');
      
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
        console.log('✅ JWT token regenerated successfully');
        
        // Store the new JWT token
        localStorage.setItem('fitapp_jwt_token', result.token);
        localStorage.setItem('fitapp_jwt_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
        
        // Update user data if backend returned updated data
        // Convert database user format to frontend format (sub instead of googleId)
        if (result.user) {
          const dbUserData = {
            sub: result.user.googleId,
            name: result.user.name,
            email: result.user.email,
            picture: result.user.picture,
            steps: result.user.steps,
            weight: result.user.weight,
            lastSync: result.user.lastSync
          };
          localStorage.setItem('fitapp_user', JSON.stringify(dbUserData));
          setUser(dbUserData);
        }
        
        return result.token;
      } else {
        const error = await response.json();
        console.error('❌ Failed to regenerate JWT token:', error);
        return null;
      }
    } catch (err) {
      console.error('❌ Error regenerating JWT token:', err);
      return null;
    }
  };

  // Initialize user context on app load
  useEffect(() => {
    const initializeUserContext = async () => {
      try {
        const storedUser = localStorage.getItem('fitapp_user')
        const token = localStorage.getItem('fitapp_access_token')
        const expiry = localStorage.getItem('fitapp_access_token_expiry')
        const lastLoginTime = localStorage.getItem('fitapp_last_login')

        console.log('🔍 UserContext: Loading user data from localStorage:', {
          storedUser: storedUser ? JSON.parse(storedUser) : null,
          hasToken: !!token,
          hasExpiry: !!expiry,
          isExpired: expiry ? Date.now() > parseInt(expiry, 10) : true,
          lastLoginTime: lastLoginTime ? new Date(parseInt(lastLoginTime)).toISOString() : null
        })

        // Clear any hash fragments that might cause redirect loops
        if (typeof window !== 'undefined' && window.location.hash) {
          console.log('🧹 UserContext: Clearing hash fragment to prevent redirect loops')
          window.history.replaceState(null, null, window.location.pathname)
        }

        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            
            // Convert lastSync from string to Date object if it exists (JSON.parse converts Date to string)
            if (userData.lastSync && typeof userData.lastSync === 'string') {
              userData.lastSync = new Date(userData.lastSync)
            }
            
            // Check if session is still valid (30 days from last login)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days
            
            if (lastLoginTime && parseInt(lastLoginTime) > thirtyDaysAgo) {
              // Session is still valid - extend it
              localStorage.setItem('fitapp_last_login', Date.now().toString())
              console.log('✅ Login session valid and extended - user won\'t need to login again for 30 days')
              
              // Check if JWT token is expired - if so, regenerate it
              if (isJWTTokenExpired()) {
                console.log('⚠️ JWT token expired, regenerating it silently...')
                await regenerateJWTToken(userData)
              } else {
                console.log('✅ JWT token is still valid')
              }
              
              // Set user data
              setUser(userData)
              
              // Check if user has valid Google Fit permissions
              if (hasValidGoogleFitPermissions()) {
                console.log('✅ User has valid Google Fit permissions, no need to request them again')
              } else {
                console.log('⚠️ User logged in but Google Fit permissions expired or missing')
              }
            } else if (!lastLoginTime) {
              // First time loading - set login timestamp and user data
              // This handles cases where user data exists but lastLoginTime was never set
              localStorage.setItem('fitapp_last_login', Date.now().toString())
              console.log('🔄 Set initial login timestamp for 30-day persistence')
              setUser(userData)
            } else {
              // Session expired - clear user data
              console.log('⏰ Login session expired (older than 30 days), clearing user data')
              localStorage.removeItem('fitapp_user')
              localStorage.removeItem('fitapp_access_token')
              localStorage.removeItem('fitapp_access_token_expiry')
              localStorage.removeItem('fitapp_jwt_token')
              localStorage.removeItem('fitapp_jwt_expiry')
              localStorage.removeItem('fitapp_last_login')
              setUser(null)
            }
          } catch (parseError) {
            console.error('❌ Error parsing stored user data:', parseError)
            // Clear corrupted user data
            localStorage.removeItem('fitapp_user')
            localStorage.removeItem('fitapp_last_login')
            setUser(null)
          }
        } else {
          console.log('❌ UserContext: No user data found in localStorage')
        }
      } catch (error) {
        console.error('❌ Error initializing user context:', error)
        // Clear corrupted data
        localStorage.removeItem('fitapp_user')
        localStorage.removeItem('fitapp_access_token')
        localStorage.removeItem('fitapp_access_token_expiry')
        localStorage.removeItem('fitapp_jwt_token')
        localStorage.removeItem('fitapp_jwt_expiry')
        localStorage.removeItem('fitapp_last_login')
        setUser(null)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeUserContext()
  }, [])

  const login = (userData, accessToken, expiryTime) => {
    console.log('🔐 UserContext: Login called with user data:', userData)
    console.log('🔐 UserContext: Current user state before login:', user)
    
    // Check if this is a different user than the last one
    const existingUserData = localStorage.getItem('fitapp_user')
    const existingChallengeData = localStorage.getItem('fitapp_challenge')
    
    if (existingUserData && existingChallengeData) {
      try {
        const existingUser = JSON.parse(existingUserData)
        if (existingUser.sub !== userData.sub || existingUser.email !== userData.email) {
          console.log('🔄 Different user logging in - clearing previous user\'s challenge data')
          localStorage.removeItem('fitapp_challenge')
          
          // Also clear any chat data from the previous user
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chat_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
      } catch (error) {
        console.log('⚠️ Error parsing existing user data, clearing all data')
        localStorage.removeItem('fitapp_challenge')
      }
    }
    
    setUser(userData)
    localStorage.setItem('fitapp_user', JSON.stringify(userData))
    
    // Set login timestamp for session persistence (30 days)
    localStorage.setItem('fitapp_last_login', Date.now().toString())
    
    // Only save access token if we have one (for Google Fit scopes)
    if (accessToken) {
      localStorage.setItem('fitapp_access_token', accessToken)
      const finalExpiryTime = expiryTime || (Date.now() + 24 * 3600 * 1000) // fallback: 24 hours from now
      localStorage.setItem('fitapp_access_token_expiry', finalExpiryTime.toString())
      
      // Save token to backend so backend can use it for future refreshes
      // Do this asynchronously so it doesn't block the login flow
      (async () => {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:253',message:'Saving token to backend during login',data:{hasToken:!!accessToken,expiryTime:finalExpiryTime},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const apiUrl = getApiUrl()
          const saveResponse = await fetch(`${apiUrl}/api/save-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleId: userData.sub,
              name: userData.name,
              email: userData.email,
              picture: userData.picture,
              accessToken: accessToken,
              refreshToken: null, // GIS doesn't provide refresh tokens
              tokenExpiry: finalExpiryTime
            })
          })
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:268',message:'Token save response during login',data:{status:saveResponse.status,ok:saveResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          if (saveResponse.ok) {
            console.log('✅ Access token saved to backend during login')
          } else {
            console.warn('⚠️ Failed to save access token to backend during login:', saveResponse.status)
          }
        } catch (err) {
          console.warn('⚠️ Error saving access token to backend during login:', err)
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:275',message:'Token save error during login',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      })()
    }

    // Check if JWT token exists in localStorage (set by GoogleLoginButton)
    const jwtToken = localStorage.getItem('fitapp_jwt_token')
    if (jwtToken) {
      console.log('✅ JWT token found in localStorage, API authentication ready')
    } else {
      console.log('⚠️ No JWT token found - API calls may fail until re-authentication')
    }
    
    console.log('💾 UserContext: User data saved to localStorage:', {
      name: userData.name,
      email: userData.email,
      sub: userData.sub,
      picture: userData.picture ? 'present' : 'missing',
      hasAccessToken: !!accessToken
    })
    
    // Only sync Google Fit data if we have an access token
    if (accessToken) {
      syncGoogleFitData(accessToken)
      console.log('✅ Google Fit access token provided, skipping post-login auto-refresh')
    } else {
      // No access token means we need to do post-login refresh to get Google Fit permissions
      console.log('🔄 Scheduling auto-refresh after login (no access token provided)...')
      setTimeout(() => {
        if (autoRefreshUserData) {
          setPostLoginRefreshing(true)
          console.log('🔄 Triggering post-login data refresh...')
          autoRefreshUserData(false).then((result) => {
            if (result?.summary?.totalPointsAwarded > 0) {
              console.log(`🎉 Login refresh earned ${result.summary.totalPointsAwarded} point(s)!`)
            } else {
              console.log('✅ Post-login refresh complete - data is up to date')
            }
            
            // Notify components that data has been refreshed
            setLastDataRefresh(Date.now())
            console.log('📢 Post-login data refresh complete - notifying components')
          }).catch((error) => {
            console.log('⚠️ Login refresh failed:', error.message)
          }).finally(() => {
            setPostLoginRefreshing(false)
          })
        }
      }, 2000) // 2 second delay to let UI and other processes settle
    }
  }

  // Try to refresh token from backend first (silent refresh using stored refresh tokens)
  // Falls back to requesting permissions from Google if backend refresh fails
  const refreshGoogleFitToken = async () => {
    const storedUser = JSON.parse(localStorage.getItem('fitapp_user') || '{}')
    if (!storedUser?.sub) {
      throw new Error('No user found in localStorage')
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/auth/refresh-google-fit-token/${storedUser.sub}`)
      
      if (response.ok) {
        const result = await response.json()
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:309',message:'Backend token refresh successful',data:{refreshed:result.refreshed,hasToken:!!result.accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Store the refreshed token
        localStorage.setItem('fitapp_access_token', result.accessToken)
        localStorage.setItem('fitapp_access_token_expiry', result.expiryTime.toString())
        
        console.log(`✅ Google Fit token refreshed from backend${result.refreshed ? ' (was expired)' : ' (still valid)'}`)
        return result.accessToken
      } else if (response.status === 401) {
        const errorData = await response.json()
        if (errorData.needsReauth) {
          // Backend says user needs to re-authenticate - fall through to requestGoogleFitPermissions
          console.log('⚠️ Backend refresh failed - user needs to re-authenticate')
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:325',message:'Backend refresh failed - needs reauth',data:{status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          throw new Error('needsReauth')
        }
        throw new Error(`Backend refresh failed: ${response.status}`)
      } else {
        throw new Error(`Backend refresh failed: ${response.status}`)
      }
    } catch (error) {
      if (error.message === 'needsReauth') {
        throw error // Re-throw to trigger fallback
      }
      console.warn('⚠️ Backend token refresh failed, will try Google Identity Services:', error)
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:335',message:'Backend refresh error - falling back',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error
    }
  }

  // Request Google Fit permissions when needed
  const requestGoogleFitPermissions = () => {
    return new Promise((resolve, reject) => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:340',message:'requestGoogleFitPermissions called',data:{hasValidPerms:hasValidGoogleFitPermissions()},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Check if user already has valid permissions
      if (hasValidGoogleFitPermissions()) {
        const token = localStorage.getItem('fitapp_access_token')
        console.log('✅ User already has valid Google Fit permissions, using existing token')
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:345',message:'Using existing valid token',data:{hasToken:!!token},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        resolve(token)
        return
      }

      // Wait for Google Identity Services to load if not available immediately
      const checkGoogleServices = () => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          return true;
        }
        return false;
      };

      if (checkGoogleServices()) {
        initializeTokenClient();
      } else {
        // Wait up to 5 seconds for Google Services to load
        let attempts = 0;
        const maxAttempts = 10; // 5 seconds total
        const checkInterval = setInterval(() => {
          attempts++;
          if (checkGoogleServices()) {
            clearInterval(checkInterval);
            initializeTokenClient();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            reject(new Error('Google Identity Services failed to load within 5 seconds'));
          }
        }, 500);
      }

      function initializeTokenClient() {
        try {
          // Get client_id from environment variable (required)
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
          if (!clientId) {
            console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables')
            return
          }
          
          if (!clientId || clientId.trim() === '') {
            console.error('❌ Google Client ID is missing')
            reject(new Error('Google authentication is not configured'))
            return
          }

          // Validate client_id format
          if (!clientId.includes('.apps.googleusercontent.com')) {
            console.error('❌ Invalid Google Client ID format:', clientId)
            reject(new Error('Invalid Google Client ID format'))
            return
          }

          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/userinfo.profile',
            callback: async (response) => {
              const accessToken = response.access_token;
              const expiresIn = response.expires_in || 3600;
              const expiryTime = Date.now() + expiresIn * 1000;
              
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:370',message:'Token client callback - new token received',data:{hasToken:!!accessToken,expiresIn,expiryTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
              localStorage.setItem('fitapp_access_token', accessToken);
              localStorage.setItem('fitapp_access_token_expiry', expiryTime.toString());
              
              // Save token to backend so backend can use it for future refreshes
              const storedUser = JSON.parse(localStorage.getItem('fitapp_user') || '{}')
              if (storedUser?.sub) {
                try {
                  // #region agent log
                  fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:438',message:'Saving token to backend after Google permissions',data:{hasToken:!!accessToken,expiryTime},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  const apiUrl = getApiUrl()
                  const saveResponse = await fetch(`${apiUrl}/api/save-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      googleId: storedUser.sub,
                      name: storedUser.name,
                      email: storedUser.email,
                      picture: storedUser.picture,
                      accessToken: accessToken,
                      refreshToken: null, // GIS doesn't provide refresh tokens
                      tokenExpiry: expiryTime
                    })
                  })
                  // #region agent log
                  fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:455',message:'Token save response after Google permissions',data:{status:saveResponse.status,ok:saveResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  if (!saveResponse.ok) {
                    console.warn('⚠️ Failed to save token to backend:', saveResponse.status);
                  }
                } catch (err) {
                  console.warn('⚠️ Failed to save token to backend:', err);
                  // #region agent log
                  fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:462',message:'Token save error after Google permissions',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                }
              }
              
              console.log('✅ Google Fit permissions granted');
              resolve(accessToken);
            },
          });

          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:383',message:'Requesting access token from Google',data:{action:'requestAccessToken'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          tokenClient.requestAccessToken();
        } catch (error) {
          console.error('❌ Error initializing token client:', error);
          reject(error);
        }
      }
    });
  };

  // Function to automatically sync step points for current user
  const syncStepPoints = async () => {
    if (!user?.sub) {
      console.log('⚠️ No user logged in for step point sync');
      return null;
    }

    try {
      console.log('🔄 Syncing step points for current user...');
      
      const response = await fetchWithAuth(`${getApiUrl()}/api/sync-step-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.sub
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Step point sync result:', result);
        
        // Check if any points were earned
        const userResult = result.results?.[0];
        if (userResult?.pointsEarned > 0) {
          console.log(`🏆 User earned ${userResult.pointsEarned} step point(s)!`);
        }
        
        return result;
      } else {
        console.error('❌ Step point sync failed:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ Error during step point sync:', error);
      return null;
    }
  };

  // Auto-refresh function that syncs Google Fit data and step points
  const autoRefreshUserData = async (silent = true) => {
    if (!user?.sub) {
      return null;
    }

    try {
      if (!silent) console.log('🔄 Auto-refreshing user data...');
      
      const now = Date.now();
      let syncedGoogleFit = false;
      
      // Check if we're rate limited
      if (rateLimitedUntil.current && now < rateLimitedUntil.current) {
        const remainingMinutes = Math.ceil((rateLimitedUntil.current - now) / 60000);
        if (!silent) console.log(`⏳ Google Fit rate limited for ${remainingMinutes} more minute(s), skipping Google Fit sync`);
      } else {
        // Check if we synced recently (within last 2 minutes)
        const timeSinceLastSync = lastGoogleFitSync.current ? now - lastGoogleFitSync.current : Infinity;
        const minSyncInterval = 2 * 60 * 1000; // 2 minutes
        
        // Only sync Google Fit if user has valid permissions and enough time has passed
        if (timeSinceLastSync >= minSyncInterval && hasValidGoogleFitPermissions()) {
          try {
            // 1. Try to sync Google Fit data
            await syncGoogleFitData();
            lastGoogleFitSync.current = now;
            syncedGoogleFit = true;
            if (!silent) console.log('✅ Google Fit data synced successfully');
          } catch (error) {
            // Handle rate limiting
            if (error.message.includes('429') || error.message.includes('RATE_LIMIT_EXCEEDED')) {
              console.log('⚠️ Google Fit rate limited, will retry in 5 minutes');
              rateLimitedUntil.current = now + (5 * 60 * 1000); // 5 minutes
            } else {
              if (!silent) console.log('⚠️ Google Fit sync failed, continuing with step points sync:', error.message);
            }
          }
        } else if (timeSinceLastSync < minSyncInterval) {
          const nextSyncIn = Math.ceil((minSyncInterval - timeSinceLastSync) / 1000);
          if (!silent) console.log(`🕐 Google Fit synced recently, next sync in ${nextSyncIn} seconds`);
        } else if (!hasValidGoogleFitPermissions()) {
          if (!silent) console.log('⚠️ User does not have valid Google Fit permissions, skipping sync');
        }
      }
      
      // 2. Always try to sync step points (uses existing step data from user object)
      const stepPointResult = await syncStepPoints();
      
      if (!silent) {
        if (stepPointResult?.summary?.totalPointsAwarded > 0) {
          console.log(`🎉 Auto-refresh earned ${stepPointResult.summary.totalPointsAwarded} point(s)!`);
        }
        console.log(`📊 Auto-refresh complete: Google Fit ${syncedGoogleFit ? 'synced' : 'skipped'}, step points checked`);
      }
      
      return stepPointResult;
    } catch (error) {
      if (!silent) console.error('❌ Auto-refresh failed:', error);
      return null;
    }
  };

  // Auto-refresh fitness data if user has none when loaded from localStorage
  useEffect(() => {
    if (user?.sub && autoRefreshUserData && !isInitializing) {
      const hasNoFitnessData = user.steps === null || user.steps === undefined || user.weight === null || user.weight === undefined;
      if (hasNoFitnessData && hasValidGoogleFitPermissions()) {
        // Small delay to let everything initialize, then auto-refresh
        const timeoutId = setTimeout(() => {
          console.log('🔄 Auto-refreshing user with missing fitness data...');
          autoRefreshUserData(false);
        }, 2000);
        
        return () => clearTimeout(timeoutId);
      } else if (hasNoFitnessData && !hasValidGoogleFitPermissions()) {
        console.log('⚠️ User has no fitness data but also no valid Google Fit permissions - will need to login again');
      }
    }
  }, [user?.sub, user?.steps, user?.weight, autoRefreshUserData, isInitializing]);

  const syncGoogleFitData = async (token) => {
    try {
      console.log('🚀 syncGoogleFitData function called with token:', token ? 'provided' : 'not provided');
    
    // If no token provided, get from storage
    let accessToken = token || localStorage.getItem('fitapp_access_token')
    const tokenExpiry = localStorage.getItem('fitapp_access_token_expiry')
    const expiryTime = tokenExpiry ? parseInt(tokenExpiry, 10) : null
    const now = Date.now()
    const isExpired = isTokenExpired()
    const hasValidPerms = hasValidGoogleFitPermissions()
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:519',message:'syncGoogleFitData entry - token state',data:{hasToken:!!accessToken,tokenLength:accessToken?accessToken.length:0,expiryTime,now,isExpired,hasValidPerms,hoursUntilExpiry:expiryTime?(expiryTime-now)/(1000*60*60):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    console.log('🔑 Access token status:', {
      hasToken: !!accessToken,
      tokenLength: accessToken ? accessToken.length : 0,
      isExpired: isExpired,
      hasValidPerms: hasValidPerms
    });
    
    // If no access token or token is expired, refresh it proactively BEFORE making API calls
    // First try backend refresh (silent, no user prompt), then fall back to Google Identity Services if needed
    // This prevents 401 errors and ensures we always have a valid token
    if (!accessToken || isExpired) {
      try {
        if (!accessToken) {
          console.log('🔐 No access token, trying backend refresh first...');
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:534',message:'No token - trying backend refresh',data:{action:'refreshGoogleFitToken'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } else {
          const hoursExpired = expiryTime ? (now - expiryTime) / (1000 * 60 * 60) : Infinity
          console.log(`🔐 Token expired ${hoursExpired.toFixed(1)} hours ago, refreshing proactively from backend...`);
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:537',message:'Token expired - refreshing from backend',data:{hoursExpired,action:'refreshGoogleFitToken'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
        
        // Try backend refresh first (silent, uses stored refresh tokens)
        try {
          accessToken = await refreshGoogleFitToken();
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:542',message:'Backend refresh successful',data:{hasNewToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } catch (refreshError) {
          // Backend refresh failed - fall back to Google Identity Services (will prompt user)
          if (refreshError.message === 'needsReauth' || !accessToken) {
            console.log('⚠️ Backend refresh unavailable, requesting Google Fit permissions from Google...');
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:546',message:'Backend refresh failed - falling back to Google',data:{error:refreshError.message,action:'requestGoogleFitPermissions'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            accessToken = await requestGoogleFitPermissions();
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:548',message:'Google permissions granted',data:{hasNewToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          } else {
            throw refreshError;
          }
        }
      } catch (error) {
        console.error('❌ Failed to get/refresh Google Fit permissions:', error);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:554',message:'All refresh methods failed',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw error;
      }
    }
    
    // First, check for missing days in the last 30 days
    const storedUser = JSON.parse(localStorage.getItem('fitapp_user'))
    if (!storedUser || !storedUser.sub) {
      console.error('❌ No user found in localStorage')
      return
    }

    const apiUrl = getApiUrl()
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30) // Check last 30 days
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    // Get existing fitness history to find missing days
    let existingHistory = []
    try {
      const startDateStr = start.toISOString().split('T')[0]
      const endDateStr = end.toISOString().split('T')[0]
      const historyResponse = await fetchWithAuth(
        `${apiUrl}/api/user/fitness-history/${storedUser.sub}?startDate=${startDateStr}&endDate=${endDateStr}&limit=100`
      )
      
      if (historyResponse.ok) {
        existingHistory = await historyResponse.json()
        console.log(`📊 Found ${existingHistory.length} existing history entries`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch existing history, will fetch all days:', error)
    }

    // Create a set of dates that already have data
    const existingDates = new Set()
    existingHistory.forEach(entry => {
      if (entry.date) {
        const dateKey = new Date(entry.date).toISOString().split('T')[0]
        existingDates.add(dateKey)
      }
    })

    // Find missing days (days with 0 steps or no data, excluding today)
    // Also find days that have steps but no weight (need to fetch weight data)
    const missingDays = []
    const daysNeedingWeight = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]
      const isToday = d.getTime() === today.getTime()
      
      // Skip today - we'll always fetch today's data
      if (isToday) continue
      
      // Check if this day is missing or has 0 steps
      if (!existingDates.has(dateKey)) {
        missingDays.push(new Date(d))
      } else {
        // Check if existing entry has 0 steps
        const existingEntry = existingHistory.find(e => {
          const entryDate = new Date(e.date).toISOString().split('T')[0]
          return entryDate === dateKey
        })
        if (existingEntry && existingEntry.steps === 0) {
          missingDays.push(new Date(d))
        } else if (existingEntry && existingEntry.steps > 0 && (existingEntry.weight === null || existingEntry.weight === undefined)) {
          // Day has steps but no weight - need to fetch weight data
          daysNeedingWeight.push(new Date(d))
        }
      }
    }

    const missingDaysList = missingDays.map(d => d.toISOString().split('T')[0])
    const daysNeedingWeightList = daysNeedingWeight.map(d => d.toISOString().split('T')[0])
    
    // Combine missing days and days needing weight for sync
    const daysToSync = [...missingDays, ...daysNeedingWeight]
    
    // Always fetch the full 30-day range to ensure we get historical weight data
    // Even if all days have step data, we might need to fetch weight data from Google Fit
    if (daysToSync.length === 0 && daysNeedingWeight.length === 0) {
      console.log('✅ No missing days or days needing weight found, but fetching full 30-day range for weight data')
      // Continue to fetch full 30-day range below (don't return early)
    }

    // Calculate date range for missing days
    // But we want to include ALL days in the last 30 days, not just missing ones
    // This ensures we can update existing days with incorrect data
    const rangeStart = new Date(start)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = new Date(end)
    rangeEnd.setHours(23, 59, 59, 999)
    
    // Use the full 30-day range, not just missing days range
    const missingStart = daysToSync.length > 0 ? 
      new Date(Math.min(...daysToSync.map(d => d.getTime()))) : 
      rangeStart
    missingStart.setHours(0, 0, 0, 0)
    const missingEnd = daysToSync.length > 0 ? 
      new Date(Math.max(...daysToSync.map(d => d.getTime()))) : 
      rangeEnd
    missingEnd.setHours(23, 59, 59, 999)
    
    // Ensure we fetch the full 30-day range to update existing days
    const fetchStart = rangeStart.getTime() < missingStart.getTime() ? rangeStart : missingStart
    const fetchEnd = rangeEnd.getTime() > missingEnd.getTime() ? rangeEnd : missingEnd
    
    console.log('📅 Time range for missing days sync:', {
      start: fetchStart.toISOString(),
      end: fetchEnd.toISOString(),
      missingDaysCount: missingDays.length,
      fullRange: `${rangeStart.toISOString()} to ${rangeEnd.toISOString()}`
    });

    try {
      
      // Note: We only request 'delta' in aggregateBy, but we'll check for 'summary' in the response
      // 'summary' is not a valid aggregate data type, but may appear in responses from synced devices
      const requestBody = {
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.weight' }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: fetchStart.getTime(),
        endTimeMillis: fetchEnd.getTime()
      };
      
      // Try API call - if we get 401, refresh token and retry
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:694',message:'Before first API call',data:{hasToken:!!accessToken,tokenPrefix:accessToken?accessToken.substring(0,20):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      let response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:701',message:'First API call response',data:{status:response.status,statusText:response.statusText,is401:response.status===401},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // If we get 401 (Unauthorized), the token is invalid - refresh it and retry
      if (response.status === 401) {
        console.log('⚠️ Token invalid (401), refreshing token...');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:705',message:'401 received - refreshing token',data:{action:'requestGoogleFitPermissions'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        try {
          accessToken = await requestGoogleFitPermissions();
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:707',message:'Token refreshed after 401',data:{hasNewToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Retry the API call with the new token
          response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:716',message:'Retry API call after refresh',data:{status:response.status,statusText:response.statusText,isOk:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          console.log('📥 Retry response status:', response.status, response.statusText);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Google Fit API error after token refresh:', errorText);
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:720',message:'Retry failed after refresh',data:{status:response.status,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            throw new Error(`Google Fit API error: ${response.status} ${response.statusText} - ${errorText}`);
          }
        } catch (refreshError) {
          console.error('❌ Failed to refresh token after 401:', refreshError);
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:726',message:'Refresh failed after 401',data:{error:refreshError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          throw refreshError;
        }
      } else if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Google Fit API error response:', errorText);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserContext.jsx:730',message:'API call failed with non-401 error',data:{status:response.status,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error(`Google Fit API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Google Fit API error response:', errorText);
        throw new Error(`Google Fit API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json()

      // Process all buckets and save to backend
      if (data.bucket && data.bucket.length > 0) {
        const historyData = []
        
        data.bucket.forEach((bucket, bucketIndex) => {
          // Google Fit returns startTimeMillisNanos (nanoseconds) - convert to milliseconds
          // Also check startTimeMillis directly (some responses use this, and it might be a string)
          let bucketStartMillis = bucket.startTimeMillisNanos ? 
            parseInt(bucket.startTimeMillisNanos) / 1000000 : 
            (bucket.startTimeMillis ? parseInt(bucket.startTimeMillis) : null)
          
          if (!bucketStartMillis || isNaN(bucketStartMillis) || bucketStartMillis <= 0) {
            return // Skip invalid buckets
          }
          
          const bucketDate = new Date(bucketStartMillis)
          if (isNaN(bucketDate.getTime())) {
            return // Skip invalid dates
          }
          
          const dateKey = bucketDate.toISOString().split('T')[0]
          
          // Check for step data - Fitbit synced data often uses 'summary' instead of 'delta'
          const stepsData = bucket.dataset?.find(d => 
            d.dataTypeName === 'com.google.step_count.delta' ||
            d.dataTypeName === 'com.google.step_count.summary' ||
            d.dataSourceId?.includes('step_count.delta') ||
            d.dataSourceId?.includes('step_count.summary') ||
            d.dataSourceId?.includes('fitbit') ||
            d.point?.[0]?.dataTypeName === 'com.google.step_count.delta' ||
            d.point?.[0]?.dataTypeName === 'com.google.step_count.summary'
          )
          
          const weightData = bucket.dataset?.find(d => 
            d.dataTypeName === 'com.google.weight' || 
            d.dataSourceId?.includes('weight')
          )
          
          // Extract steps - handle both delta and summary data types
          // Summary data may have multiple points, so we sum them or take the last one
          let steps = 0
          if (stepsData?.point && stepsData.point.length > 0) {
            // For summary data, we might need to sum all points or take the last one
            // Try to get the value from the first point first
            const firstPointValue = stepsData.point[0]?.value?.[0]?.intVal
            if (firstPointValue !== undefined && firstPointValue !== null) {
              steps = firstPointValue
            } else if (stepsData.point.length > 1) {
              // If first point doesn't have value, try the last point (common for summary)
              const lastPointValue = stepsData.point[stepsData.point.length - 1]?.value?.[0]?.intVal
              if (lastPointValue !== undefined && lastPointValue !== null) {
                steps = lastPointValue
              }
            }
          }
          
          // Log if we found steps data but couldn't extract it (only log errors)
          if (stepsData && steps === 0) {
            console.warn(`⚠️ Found steps data source but couldn't extract steps for ${dateKey}`)
          }
          
          // Extract weight - use the LAST point and LAST value (like backend does)
          let weightKg = null
          if (weightData && weightData.point && weightData.point.length > 0) {
            const latestWeightPoint = weightData.point[weightData.point.length - 1]
            if (latestWeightPoint.value && latestWeightPoint.value.length > 0) {
              const weightValue = latestWeightPoint.value[latestWeightPoint.value.length - 1]
              if (weightValue.fpVal !== undefined && weightValue.fpVal > 0) {
                weightKg = weightValue.fpVal
              }
            }
          }
          
          // Convert from kg to lbs if needed (backend checks if < 150, assumes kg)
          let weight = null
          if (weightKg !== null) {
            let dayWeight = weightKg
            if (dayWeight < 150) {
              dayWeight = dayWeight * 2.20462
            }
            weight = Math.round(dayWeight * 100) / 100
          }
          
          // Check if this day is in the missing days list or needs weight
          const isMissingDay = missingDays.some(md => {
            const mdKey = md.toISOString().split('T')[0]
            return mdKey === dateKey
          })
          const needsWeight = daysNeedingWeight.some(d => {
            const dKey = d.toISOString().split('T')[0]
            return dKey === dateKey
          })
          
          // Save all days that have data, even if they already exist (to update incorrect data)
          // Also save days that need weight data even if they already have steps
          const shouldSave = (isMissingDay || needsWeight || existingDates.has(dateKey)) && (steps > 0 || weight !== null)
          
          if (shouldSave) {
            historyData.push({
              date: bucketDate,
              steps: steps,
              weight: weight
            })
          }
        })
        
        // Save all fetched days to backend
        if (historyData.length > 0) {
          await saveFitnessHistoryToBackend(historyData)
        }
      }

      // Also get today's data for user state update
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      
      // Note: We only request 'delta' in aggregateBy, but we'll check for 'summary' in the response
      const todayRequestBody = {
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.weight' }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: todayStart.getTime(),
        endTimeMillis: todayEnd.getTime()
      }

      let todayResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todayRequestBody)
      })

      // If we get 401 (Unauthorized), the token is invalid - refresh it and retry
      if (todayResponse.status === 401) {
        console.log('⚠️ Token invalid (401) on second API call, refreshing token...');
        try {
          accessToken = await requestGoogleFitPermissions();
          // Retry the API call with the new token
          todayResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(todayRequestBody)
          });
          
          console.log('📥 Retry second API call response status:', todayResponse.status, todayResponse.statusText);
          
          if (!todayResponse.ok) {
            const errorText = await todayResponse.text();
            console.error('❌ Google Fit API error after token refresh on second call:', errorText);
            // Don't throw - just log the error and continue
          }
        } catch (refreshError) {
          console.error('❌ Failed to refresh token after 401 on second call:', refreshError);
          // Don't throw - just log the error and continue
        }
      } else if (!todayResponse.ok) {
        const errorText = await todayResponse.text();
        console.error('❌ Google Fit API error on second call:', errorText);
        // Don't throw - just log the error and continue
      }

      // Process today's data for user state update
      if (todayResponse.ok) {
        const todayData = await todayResponse.json()
        const todayBucket = todayData.bucket?.[0]
        
        if (todayBucket) {
          // Check for step data - Fitbit synced data often uses 'summary' instead of 'delta'
          const stepsData = todayBucket.dataset?.find(d => 
            d.dataTypeName === 'com.google.step_count.delta' ||
            d.dataTypeName === 'com.google.step_count.summary' ||
            d.dataSourceId?.includes('step_count.delta') ||
            d.dataSourceId?.includes('step_count.summary') ||
            d.dataSourceId?.includes('fitbit') ||
            d.point?.[0]?.dataTypeName === 'com.google.step_count.delta' ||
            d.point?.[0]?.dataTypeName === 'com.google.step_count.summary'
          )
          const weightData = todayBucket.dataset?.find(d => 
            d.dataTypeName === 'com.google.weight' ||
            d.point?.[0]?.dataTypeName === 'com.google.weight' ||
            d.point?.[0]?.dataTypeName === 'com.google.weight.summary'
          )

          // Extract steps - handle both delta and summary data types
          let steps = 0
          if (stepsData?.point && stepsData.point.length > 0) {
            const firstPointValue = stepsData.point[0]?.value?.[0]?.intVal
            if (firstPointValue !== undefined && firstPointValue !== null) {
              steps = firstPointValue
            } else if (stepsData.point.length > 1) {
              // Try the last point for summary data
              const lastPointValue = stepsData.point[stepsData.point.length - 1]?.value?.[0]?.intVal
              if (lastPointValue !== undefined && lastPointValue !== null) {
                steps = lastPointValue
              }
            }
          }
          
          const weightKg = weightData?.point?.[0]?.value?.[0]?.fpVal ?? null
          const weight = weightKg ? Math.round(weightKg * 2.20462 * 100) / 100 : null

          console.log('📈 Parsed today\'s fitness data:', { 
            steps, 
            weightKg, 
            weightLbs: weight,
            stepsDataType: stepsData?.dataTypeName,
            stepsDataSourceId: stepsData?.dataSourceId,
            stepsPointCount: stepsData?.point?.length || 0
          });
          
          // Log if we found steps data but couldn't extract it
          if (stepsData && steps === 0) {
            console.warn('⚠️ Found steps data source but couldn\'t extract steps:', {
              dataTypeName: stepsData.dataTypeName,
              dataSourceId: stepsData.dataSourceId,
              pointCount: stepsData.point?.length || 0,
              firstPoint: stepsData.point?.[0]
            })
          }

          // Update user state with today's data
          setUser(prev => ({
            ...prev,
            steps,
            weight,
            lastSync: new Date()
          }))

          // Save today's data to backend
          await saveFitnessDataToBackend(steps, weight)
        } else {
          console.log('⚠️ No data for today, setting defaults');
          setUser(prev => ({
            ...prev,
            steps: 0,
            weight: null,
            lastSync: new Date()
          }));
          await saveFitnessDataToBackend(0, null);
        }
      } else {
        console.warn('⚠️ Failed to fetch today\'s data');
      }
      
    } catch (error) {
      console.error('❌ Failed to sync Google Fit data:', error)
      throw error;
    }
    } catch (syncError) {
      console.error('💥 syncGoogleFitData function error:', syncError);
      throw syncError;
    }
  }

  // Helper function to save fitness data to backend
  const saveFitnessDataToBackend = async (steps, weight) => {
    const storedUser = JSON.parse(localStorage.getItem('fitapp_user'))
    if (storedUser && storedUser.sub) {
      try {
        // Use the same API URL pattern as other components
        const apiUrl = getApiUrl()
        
        const response = await fetchWithAuth(`${apiUrl}/api/user/userdata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleId: storedUser.sub,
            name: storedUser.name,
            email: storedUser.email,
            picture: storedUser.picture,
            steps,
            weight
          })
        })
        
        if (response.ok) {
          const result = await response.json()
        } else {
          const error = await response.json()
          console.error('❌ Backend save failed:', error);
        }
      } catch (backendError) {
        console.error('❌ Failed to save to backend:', backendError);
        // Don't throw here - the sync was successful, just backend save failed
      }
    }
  }

  // Helper function to save multiple days of fitness history to backend
  const saveFitnessHistoryToBackend = async (historyData) => {
    const storedUser = JSON.parse(localStorage.getItem('fitapp_user'))
    if (!storedUser || !storedUser.sub || !historyData || historyData.length === 0) {
      return
    }

    try {
      const apiUrl = getApiUrl()
      
      // Save each day's data
      for (const dayData of historyData) {
        if (!dayData.date || dayData.steps === undefined) {
          continue
        }
        
        const dateStr = new Date(dayData.date).toISOString().split('T')[0]
        
        const requestBody = {
          googleId: storedUser.sub,
          name: storedUser.name,
          email: storedUser.email,
          picture: storedUser.picture,
          steps: dayData.steps,
          weight: dayData.weight || null,
          date: dateStr // Pass the date so backend saves for that specific day
        }
        
        const response = await fetchWithAuth(`${apiUrl}/api/user/userdata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
        
        if (response.ok) {
          // Successfully saved
        } else {
          const errorText = await response.text()
          console.warn(`⚠️ Failed to save fitness history for ${dateStr} to /api/user/userdata:`, response.status, errorText)
        }
      }
    } catch (error) {
      console.error('❌ Failed to save fitness history to backend:', error)
    }
  }

  // Test Google Fit API connection
  const testGoogleFitConnection = async () => {
    const accessToken = localStorage.getItem('fitapp_access_token')
    if (!accessToken) {
      console.log('❌ No access token available');
      return false;
    }

    try {
      console.log('🧪 Testing Google Fit API connection...');
      
      // Test with a simple request to get data sources
      let response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      });

      console.log('📥 Data sources response:', response.status, response.statusText);
      
      // If we get 401 (Unauthorized), the token is invalid - refresh it and retry
      if (response.status === 401) {
        console.log('⚠️ Token invalid (401) on dataSources call, refreshing token...');
        try {
          accessToken = await requestGoogleFitPermissions();
          // Retry the API call with the new token
          response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            }
          });
          
          console.log('📥 Retry dataSources response status:', response.status, response.statusText);
        } catch (refreshError) {
          console.error('❌ Failed to refresh token after 401 on dataSources call:', refreshError);
          return false;
        }
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Available data sources:', data);
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Data sources error:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Test connection failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null)
    // Clear all localStorage items to ensure clean logout
    localStorage.removeItem('fitapp_user')
    localStorage.removeItem('fitapp_access_token')
    localStorage.removeItem('fitapp_access_token_expiry')
    localStorage.removeItem('fitapp_last_login') // Clear login timestamp
    localStorage.removeItem('fitapp_challenge') // Clear challenge data to prevent cross-contamination
    
    // Also clear any chat data and other fitapp-related data to prevent confusion
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('chat_') || key.startsWith('fitapp_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage as well to reset auto-refresh timers
    sessionStorage.removeItem('fitapp_last_auto_refresh');
    sessionStorage.removeItem('fitapp_challenge_cleared');
    
    // Reset rate limiting refs
    lastGoogleFitSync.current = null;
    rateLimitedUntil.current = null;
    
    console.log('🧹 Cleaned up all user and challenge data for logout');
  }

  // Calculate step progress for current challenges
  const getStepProgress = (stepGoal) => {
    if (!user || !stepGoal || typeof stepGoal !== 'number' || stepGoal <= 0) {
      return { percentage: 0, achieved: false }
    }
    const steps = typeof user.steps === 'number' && !isNaN(user.steps) ? user.steps : 0
    const percentage = Math.min((steps / stepGoal) * 100, 100)
    const achieved = steps >= stepGoal
    return { percentage, achieved }
  }

  // Get today's step goal status
  const getTodaysStepGoalStatus = (challenges) => {
    if (!challenges || !user?.steps) return { hasAchievedAnyGoal: false, totalGoalsAchieved: 0 }
    
    let totalGoalsAchieved = 0
    let hasAchievedAnyGoal = false
    
    challenges.forEach(challenge => {
      if (challenge.stepGoal && user.steps >= challenge.stepGoal) {
        totalGoalsAchieved++
        hasAchievedAnyGoal = true
      }
    })
    
    return { hasAchievedAnyGoal, totalGoalsAchieved }
  }

  // Update user profile (name and picture)
  const updateUserProfile = async (profileData) => {
    if (!user?.sub) {
      throw new Error('User not logged in')
    }

    try {
      const apiUrl = getApiUrl()
      const response = await fetchWithAuth(`${apiUrl}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: user.sub,
          name: profileData.name,
          picture: profileData.picture
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const result = await response.json()
      
      // Update local user state using backend response (which has confirmed saved data)
      // Convert backend format (googleId) to frontend format (sub)
      setUser(prev => ({
        ...prev,
        name: result.user.name,
        picture: result.user.picture
      }))

      console.log('✅ Profile updated successfully:', result)
      return result
    } catch (error) {
      console.error('❌ Failed to update profile:', error)
      throw error
    }
  }

  return (
    <UserContext.Provider value={{ 
      user,
      setUser,
      postLoginRefreshing,
      lastDataRefresh,
      isInitializing,
      login, 
      logout, 
      syncGoogleFitData, 
      syncStepPoints,
      autoRefreshUserData,
      requestGoogleFitPermissions, 
      testGoogleFitConnection,
      getStepProgress,
      getTodaysStepGoalStatus,
      updateUserProfile
    }}>
      {children}
    </UserContext.Provider>
  )
}
