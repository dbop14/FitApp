import { useState, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { getApiUrl } from '../utils/apiService'

const ChallengeInfoModal = ({ challenge, isOpen, onClose, onUpdate }) => {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [isQuitting, setIsQuitting] = useState(false)
  const modalRef = useRef(null)
  
  // Focus management, body scroll lock, and keyboard navigation
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      // Focus the modal when it opens
      if (modalRef.current) {
        modalRef.current.focus()
      }
      
      // Handle escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
      }
    } else {
      // Restore body scroll
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])
  const [editData, setEditData] = useState({
    name: challenge?.name || '',
    startDate: challenge?.startDate || '',
    endDate: challenge?.endDate || '',
    stepGoal: challenge?.stepGoal || 8000,
    botName: challenge?.botName || '',
    botAvatar: challenge?.botAvatar || '',
    isPublic: challenge?.isPublic ?? true,
    weighInDay: challenge?.weighInDay || 'monday'
  })

  const isAdmin = challenge?.admin === user?.sub || challenge?.creatorEmail === user?.email

  const handleSave = () => {
    onUpdate({ ...editData, userGoogleId: user?.sub })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData({
      name: challenge?.name || '',
      startDate: challenge?.startDate || '',
      endDate: challenge?.endDate || '',
      stepGoal: challenge?.stepGoal || 8000,
      botName: challenge?.botName || '',
      botAvatar: challenge?.botAvatar || '',
      isPublic: challenge?.isPublic ?? true,
      weighInDay: challenge?.weighInDay || 'monday'
    })
    setIsEditing(false)
  }

  const handleEndChallenge = () => {
    if (window.confirm('Are you sure you want to end this challenge? This will set the end date to today.')) {
      const today = new Date().toISOString().split('T')[0]
      onUpdate({ ...editData, endDate: today, userGoogleId: user?.sub })
      onClose()
    }
  }

  const handleLocalCleanup = (shouldNavigate = false) => {
    // Delete chat data from localStorage
    if (challenge?._id) {
      if (window.deleteChatData) {
        window.deleteChatData(challenge._id);
      } else {
        const chatKey = `chat_${challenge._id}`;
        localStorage.removeItem(chatKey);
        console.log('🗑️ Deleted chat data for challenge:', challenge._id);
      }
    }
    
    // Clear challenge from context and localStorage immediately
    localStorage.removeItem('fitapp_challenge');
    console.log('🧹 Cleared challenge from localStorage');
    
    // Set flag to prevent auto-reloading of challenges
    sessionStorage.setItem('fitapp_challenge_cleared', Date.now().toString());
    console.log('🚫 Set flag to prevent auto-challenge reload');
    
    // Close modal
    onClose();
    
    // Navigate to dashboard instead of reloading to avoid route-specific issues
    if (shouldNavigate) {
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
    } else {
      // For other cases (like leaving challenge), reload the page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  const handleDeleteChallenge = async () => {
    if (window.confirm('Are you sure you want to DELETE this challenge? This action cannot be undone and will remove all participant data and chat history.')) {
      setIsQuitting(true)
      
      try {
        console.log('🗑️ Deleting challenge:', challenge._id)
        
        // Call the backend deletion endpoint directly
        const response = await fetch(`${getApiUrl()}/api/challenge/${challenge._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('fitapp_jwt_token')}`
          },
          body: JSON.stringify({
            _delete: true,
            userGoogleId: user?.sub
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Challenge deleted successfully:', result)
          
          // Show success message
          alert(`Challenge "${challenge.name}" has been deleted successfully.`)
          
          // Use the centralized cleanup function with navigation to dashboard
          // This avoids reloading on /challenges route which can cause 502 errors
          handleLocalCleanup(true);
        } else {
          const error = await response.json()
          console.error('❌ Failed to delete challenge:', error)
          alert(`Failed to delete challenge: ${error.error}`)
          setIsQuitting(false)
        }
      } catch (error) {
        console.error('❌ Error deleting challenge:', error)
        alert('Failed to delete challenge. Please try again.')
        setIsQuitting(false)
      }
    }
  }

  const handleLeaveChallenge = async () => {
    // Prevent leaving if user is admin or challenge is being quit
    if (isAdmin || isQuitting) {
      console.log('🚫 Cannot leave challenge: User is admin or challenge is being quit');
      return;
    }

    // Validate challenge state
    if (!challenge || !challenge._id) {
      alert('Challenge data is invalid. Please refresh the page and try again.');
      return;
    }

    if (!user || !user.sub) {
      alert('User data is invalid. Please log in again and try again.');
      return;
    }

    if (window.confirm('Are you sure you want to leave this challenge? You will lose all your progress and points.')) {
      try {
        console.log(`🚪 Attempting to leave challenge ${challenge._id} for user ${user.sub}`);
        console.log(`🔍 Challenge object:`, challenge);
        console.log(`👤 User object:`, user);
        
        // Validate challenge ID and user ID before making the request
        if (!challenge._id) {
          throw new Error('Challenge ID is missing. Please refresh the page and try again.');
        }
        
        if (!user.sub) {
          throw new Error('User ID is missing. Please log in again and try again.');
        }
        
        const apiUrl = `/api/leaderboard/${challenge._id}/participants/${user.sub}`;
        console.log(`🔗 API URL: ${apiUrl}`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout. Please try again.')), 10000); // 10 second timeout
        });
        
        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(apiUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
          timeoutPromise
        ]);

        console.log(`📤 Leave challenge response status: ${response.status}`);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Successfully left challenge:', result);
          
          // Delete chat data from localStorage
          if (challenge?._id) {
            if (window.deleteChatData) {
              window.deleteChatData(challenge._id);
            } else {
              const chatKey = `chat_${challenge._id}`;
              localStorage.removeItem(chatKey);
              console.log('🗑️ Deleted chat data for challenge:', challenge._id);
            }
          }
          
          // Clear challenge from context and localStorage immediately
          localStorage.removeItem('fitapp_challenge');
          console.log('🧹 Cleared challenge from localStorage');
          
          // Set flag to prevent auto-reloading of challenges
          sessionStorage.setItem('fitapp_challenge_cleared', Date.now().toString());
          console.log('🚫 Set flag to prevent auto-challenge reload');
          
          // Close modal and refresh the page to update the UI
          onClose();
          
          // Add a small delay to ensure backend changes are processed
          setTimeout(() => {
            window.location.reload();
          }, 500);
          
        } else {
          const errorData = await response.json();
          console.error('❌ Leave challenge failed:', errorData);
          
          // Provide more specific error messages
          let errorMessage = 'Failed to leave challenge. ';
          if (errorData.error) {
            if (errorData.error.includes('already a participant')) {
              errorMessage += 'You are no longer a participant in this challenge.';
              // If user is no longer a participant, clean up locally and close modal
              handleLocalCleanup();
              return;
            } else if (errorData.error.includes('not found')) {
              errorMessage += 'Challenge not found or already deleted.';
              // If challenge is not found, clean up locally and close modal
              handleLocalCleanup();
              return;
            } else {
              errorMessage += errorData.error;
            }
          } else {
            errorMessage += 'Please try again.';
          }
          
          alert(errorMessage);
        }
      } catch (error) {
        console.error('❌ Error leaving challenge:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          challengeId: challenge?._id,
          userId: user?.sub
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to leave challenge. ';
        if (error.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage += 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('challenge')) {
          errorMessage += 'Challenge data error. Please refresh the page and try again.';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
        
        alert(errorMessage);
      }
    }
  }



  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4 pb-8" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      style={{ alignItems: 'center', marginTop: '-50px' }}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 focus:outline-none scroll-smooth"
        tabIndex={-1}
        style={{ maxHeight: 'calc(75vh - 6rem)', minHeight: '400px' }}
      >
        <div className="p-4 sm:p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 flex-shrink-0">
            <h2 id="modal-title" className="text-xl font-bold text-gray-800">
              {isEditing ? 'Edit Challenge' : 'Challenge Info'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              ×
            </button>
          </div>

          <div id="modal-description" className="mt-4 pb-4 space-y-4 flex-1 overflow-y-auto">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Challenge Name
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editData.startDate}
                      onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={editData.endDate}
                      onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Step Goal
                  </label>
                  <input
                    type="number"
                    value={editData.stepGoal}
                    onChange={(e) => setEditData({ ...editData, stepGoal: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bot Avatar
                    </label>
                    <input
                      type="text"
                      value={editData.botAvatar}
                      onChange={(e) => setEditData({ ...editData, botAvatar: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="🤖"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bot Name
                    </label>
                    <input
                      type="text"
                      value={editData.botName}
                      onChange={(e) => setEditData({ ...editData, botName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weekly Weigh-in Day
                  </label>
                  <select
                    value={editData.weighInDay}
                    onChange={(e) => setEditData({ ...editData, weighInDay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={editData.isPublic}
                    onChange={(e) => setEditData({ ...editData, isPublic: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-700">
                    Public Challenge
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500 border border-blue-600 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {challenge?.name}
                  </h3>
                  <p className="text-white opacity-90 text-sm">
                    {challenge?.startDate} – {challenge?.endDate}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Daily Goal</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {challenge?.stepGoal?.toLocaleString()} steps
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Bot</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {challenge?.botAvatar} {challenge?.botName}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Challenge Code</p>
                  <p className="font-mono text-lg font-semibold text-gray-800">
                    {challenge?.challengeCode}
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Participants</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {(challenge?.participants?.length || 0) + 1} people
                  </p>
                  <p className="text-sm text-gray-500">
                    {challenge?.creatorEmail && `${challenge.creatorEmail} (Creator)`}
                    {challenge?.participants?.length > 0 && challenge?.creatorEmail && ', '}
                    {challenge?.participants?.join(', ')}
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Weigh-in Day</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {challenge?.weighInDay ? challenge.weighInDay.charAt(0).toUpperCase() + challenge.weighInDay.slice(1) : 'Not set'}
                  </p>
                </div>

                {isAdmin && !isQuitting && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">👑 Admin Controls</h3>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium"
                        >
                          ✏️ Edit Challenge
                        </button>
                        
                        <button
                          onClick={handleEndChallenge}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md font-medium"
                        >
                          🏁 End Challenge
                        </button>
                        
                        <button
                          onClick={handleDeleteChallenge}
                          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md font-medium"
                        >
                          🗑️ Delete Challenge
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isAdmin && !isQuitting && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">👤 Participant Controls</h3>
                      
                      <div className="space-y-3">
                        <button
                          onClick={handleLeaveChallenge}
                          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md font-medium"
                        >
                          🚪 Leave Challenge
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isQuitting && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 text-sm text-center">
                          🗑️ Deleting challenge... Please wait while we clean up the data.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChallengeInfoModal 