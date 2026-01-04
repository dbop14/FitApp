import { createContext, useContext, useState, useEffect } from 'react'
import { getApiUrl } from '../utils/apiService'

const ChallengeContext = createContext()

export { ChallengeContext }
export const useChallenge = () => useContext(ChallengeContext)

export const ChallengeProvider = ({ children }) => {
  const [challenge, setChallenge] = useState(null)

  // Validate challenge against backend - must exist AND be active
  const validateChallenge = async (challengeData, userData) => {
    if (!challengeData?._id || !userData?.sub) {
      return false
    }

    try {
      const jwtToken = localStorage.getItem('fitapp_jwt_token')
      if (!jwtToken) {
        return false
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/user-challenges/${userData.sub}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const challenges = await response.json()
        // Check if the challenge still exists, is not deleted, AND is active
        const validChallenge = challenges.find(
          c => c._id === challengeData._id && !c._deleted
        )
        
        if (!validChallenge) {
          return false
        }
        
        // Check if challenge is active (not completed)
        const now = new Date()
        const isActive = !validChallenge.endDate || new Date(validChallenge.endDate) >= now
        
        return isActive // Only return true if challenge is active
      }
      return false
    } catch (error) {
      console.error('❌ Error validating challenge:', error)
      return false
    }
  }

  useEffect(() => {
    const loadAndValidateChallenge = async () => {
      const saved = localStorage.getItem('fitapp_challenge') // Use consistent key
      const currentUser = localStorage.getItem('fitapp_user')
      
      if (saved && currentUser) {
        try {
          const challengeData = JSON.parse(saved)
          const userData = JSON.parse(currentUser)
          
          // Validate that the challenge data belongs to the current user
          // Only load if challenge was saved with current user's email/ID
          if (challengeData.savedForUser === userData.email || challengeData.savedForUser === userData.sub) {
            // Validate that the challenge still exists on the backend and is not deleted
            const isValid = await validateChallenge(challengeData, userData)
            
            if (isValid) {
              console.log('✅ Loading valid active challenge data for current user');
              setChallenge(challengeData)
            } else {
              console.log('🗑️ Challenge no longer exists, is deleted, or is not active - clearing from localStorage');
              localStorage.removeItem('fitapp_challenge')
              setChallenge(null)
            }
          } else {
            console.log('🧹 Clearing challenge data from different user');
            localStorage.removeItem('fitapp_challenge')
            setChallenge(null)
          }
        } catch (error) {
          console.error('❌ Error parsing challenge data:', error);
          localStorage.removeItem('fitapp_challenge')
          setChallenge(null)
        }
      }
    }

    loadAndValidateChallenge()
  }, [])
  
  // Periodic validation to catch stale challenges
  useEffect(() => {
    if (!challenge?._id) return
    
    const validationInterval = setInterval(() => {
      const currentUser = localStorage.getItem('fitapp_user')
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          validateChallenge(challenge, userData).then(isValid => {
            if (!isValid) {
              console.log('🗑️ Periodic validation: Challenge is no longer valid, clearing')
              localStorage.removeItem('fitapp_challenge')
              setChallenge(null)
            }
          })
        } catch (error) {
          console.error('❌ Error in periodic validation:', error)
        }
      }
    }, 30000) // Check every 30 seconds
    
    return () => clearInterval(validationInterval)
  }, [challenge])

  const saveChallenge = (data) => {
    const currentUser = localStorage.getItem('fitapp_user')
    
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser)
        
        // Validate challenge data before saving
        if (!data || !data._id || data._id === 'undefined' || data._id === 'null') {
          console.error('❌ Invalid challenge data - cannot save:', data);
          return;
        }
        
        // Check if this is a deletion request
        if (data._delete) {
          console.log('🗑️ Challenge deletion request - not saving to context');
          return;
        }
        
        const challengeWithAdmin = {
          ...data,
          admin: 'you', // Or user.name if you're passing the current user
          savedForUser: userData.email || userData.sub // Track which user saved this
        }
        setChallenge(challengeWithAdmin)
        localStorage.setItem('fitapp_challenge', JSON.stringify(challengeWithAdmin)) // Use consistent key
        console.log('💾 Saved challenge data for user:', userData.email || userData.sub);
      } catch (error) {
        console.error('❌ Error saving challenge:', error);
      }
    }
  }

  const clearChallenge = () => {
    setChallenge(null)
    localStorage.removeItem('fitapp_challenge') // Use consistent key
    console.log('🧹 Cleared challenge data');
  }

  return (
    <ChallengeContext.Provider value={{ challenge, saveChallenge, clearChallenge }}>
      {children}
    </ChallengeContext.Provider>
  )
}
