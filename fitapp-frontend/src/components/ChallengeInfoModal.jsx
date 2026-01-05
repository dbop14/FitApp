import { useState, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { getApiUrl } from '../utils/apiService'
import { compressImage } from '../utils/imageCompression'

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
    name: challenge?.name || ''
  })
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const isAdmin = challenge?.admin === user?.sub || challenge?.creatorEmail === user?.email

  // Update editData when challenge changes
  useEffect(() => {
    if (challenge) {
      setEditData({
        name: challenge.name || ''
      })
      setSelectedPhoto(null)
      setPhotoPreview(null)
    }
  }, [challenge])

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file')
      e.target.value = ''
      return
    }

    try {
      // Compress the image to stay under 5MB
      const compressedFile = await compressImage(file, 5, 1920)
      setSelectedPhoto(compressedFile)
      
      // Create preview URL from compressed file
      const reader = new FileReader()
      reader.onload = (e) => setPhotoPreview(e.target.result)
      reader.onerror = () => {
        alert('Failed to read image file')
        e.target.value = ''
      }
      reader.readAsDataURL(compressedFile)
    } catch (err) {
      alert(err.message || 'Failed to process image. Please try a different image.')
      e.target.value = ''
    }
  }

  const removePhoto = () => {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    // Reset file input
    const fileInput = document.getElementById('challenge-photo-edit')
    if (fileInput) fileInput.value = ''
  }

  const handleSave = async () => {
    if (!challenge?._id) {
      alert('Challenge ID is missing. Please refresh and try again.')
      return
    }

    if (!user?.sub) {
      alert('User information is missing. Please log in again.')
      return
    }

    setIsSaving(true)

    try {
      const apiUrl = getApiUrl()
      let nameUpdated = false
      let photoUpdated = false
      
      // First, update the challenge name if it changed
      if (editData.name !== challenge.name && editData.name.trim()) {
        const updateResponse = await fetch(`${apiUrl}/api/challenge/${challenge._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: editData.name.trim(),
            userGoogleId: user.sub
          })
        })

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({ error: 'Failed to update challenge' }))
          throw new Error(errorData.error || 'Failed to update challenge name')
        }

        nameUpdated = true
        console.log('✅ Challenge name updated')
      }

      // Then, upload photo if one was selected
      if (selectedPhoto) {
        try {
          const formData = new FormData()
          formData.append('photo', selectedPhoto)

          const photoResponse = await fetch(`${apiUrl}/api/challenge/${challenge._id}/photo`, {
            method: 'PUT',
            body: formData
          })

          if (!photoResponse.ok) {
            const errorText = await photoResponse.text()
            console.error('❌ Photo upload failed:', errorText)
            
            // Check if it's a file size error
            if (errorText.includes('File too large') || errorText.includes('MulterError')) {
              throw new Error('File is too large. Maximum size is 5MB. Please choose a smaller image.')
            }
            
            throw new Error(`Photo upload failed: ${errorText}`)
          }

          photoUpdated = true
          const photoResult = await photoResponse.json()
          console.log('✅ Photo uploaded successfully:', photoResult)
        } catch (photoError) {
          console.error('❌ Photo upload failed:', photoError)
          if (nameUpdated) {
            alert(`Challenge name was updated, but photo upload failed: ${photoError.message}`)
          } else {
            throw photoError
          }
        }
      }

      // If nothing was updated, just close the editor
      if (!nameUpdated && !photoUpdated) {
        setIsEditing(false)
        setIsSaving(false)
        return
      }

      // Fetch the updated challenge from the backend to get all latest data
      const fetchResponse = await fetch(`${apiUrl}/api/challenge/${challenge._id}`)
      if (fetchResponse.ok) {
        const updatedChallenge = await fetchResponse.json()
        onUpdate(updatedChallenge)
        console.log('✅ Challenge updated successfully')
      } else {
        // If fetch fails, construct updated challenge from what we know
        const updatedChallenge = {
          ...challenge,
          name: editData.name.trim() || challenge.name
        }
        onUpdate(updatedChallenge)
        console.log('⚠️ Updated challenge locally (could not fetch from server)')
      }

      setIsEditing(false)
      setSelectedPhoto(null)
      setPhotoPreview(null)
    } catch (err) {
      console.error('❌ Error saving challenge:', err)
      alert(`Error updating challenge: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData({
      name: challenge?.name || ''
    })
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setIsEditing(false)
  }

  const handleEndChallenge = () => {
    if (window.confirm('Are you sure you want to end this challenge? This will set the end date to today.')) {
      const today = new Date().toISOString().split('T')[0]
      onUpdate({ ...challenge, endDate: today, userGoogleId: user?.sub })
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
                    required
                  />
                </div>

                {/* Challenge Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Photo</label>
                  <div className="space-y-3">
                    {/* File Input */}
                    <input
                      id="challenge-photo-edit"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    
                    {/* Current Photo Preview */}
                    {!photoPreview && challenge?.photo && (
                      <div className="relative">
                        <img
                          src={`${getApiUrl()}${challenge.photo}`}
                          alt="Current challenge photo"
                          className="w-full h-32 object-cover rounded-md border border-gray-200"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Current photo</p>
                      </div>
                    )}
                    
                    {/* New Photo Preview */}
                    {photoPreview && (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="New challenge photo preview"
                          className="w-full h-32 object-cover rounded-md border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                          aria-label="Remove photo"
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <p className="text-xs text-gray-500 mt-1">New photo preview</p>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      Upload a new photo to replace the current one. Images will be compressed automatically. Max size: 5MB. Supported formats: JPG, PNG, GIF.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className={`flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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