import { useState, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { getApiUrl } from '../utils/apiService'
import { compressImage } from '../utils/imageCompression'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

const Fact = ({ icon, label, children, className = '' }) => (
  <div className={`flex items-start gap-3 rounded-xl bg-surface-2 p-3 ${className}`}>
    <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
    <div className="min-w-0">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="font-semibold text-ink">{children}</div>
    </div>
  </div>
)

const ChallengeInfoModal = ({ challenge, isOpen, onClose, onUpdate }) => {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [isQuitting, setIsQuitting] = useState(false)
  const modalRef = useRef(null)
  
  // Focus the dialog content when it opens (Modal handles Escape and scroll lock)
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])
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

  const weighIn = challenge?.weighInDay
    ? challenge.weighInDay.charAt(0).toUpperCase() + challenge.weighInDay.slice(1)
    : 'Not set'


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit challenge' : 'Challenge info'}
      icon={isEditing ? 'edit' : 'info'}
      footer={
        isEditing ? (
          <>
            <button onClick={handleCancel} disabled={isSaving} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        ) : null
      }
    >
      <div ref={modalRef} tabIndex={-1} className="focus:outline-none">
        {isEditing ? (
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="challenge-name-edit">
                Challenge name
              </label>
              <input
                id="challenge-name-edit"
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="challenge-photo-edit">
                Challenge photo
              </label>
              <div className="space-y-3">
                {!photoPreview && challenge?.photo && (
                  <div>
                    <img
                      src={`${getApiUrl()}${challenge.photo}`}
                      alt="Current challenge photo"
                      className="h-32 w-full rounded-xl border border-line object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <p className="mt-1 text-xs text-ink-muted">Current photo</p>
                  </div>
                )}

                {photoPreview && (
                  <div className="relative">
                    <img src={photoPreview} alt="New challenge photo preview" className="h-32 w-full rounded-xl border border-line object-cover" />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Remove photo"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                    <p className="mt-1 text-xs text-ink-muted">New photo preview</p>
                  </div>
                )}

                <input
                  id="challenge-photo-edit"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-ink"
                />
                <p className="text-xs text-ink-muted">
                  Images are compressed automatically. Max size 5MB. JPG, PNG or GIF.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="card-brand p-4">
              <h3 className="text-lg font-semibold text-white">{challenge?.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-100">
                <Icon name="calendar" className="h-4 w-4" />
                {challenge?.startDate} – {challenge?.endDate}
              </p>
              {challenge?.scoringMode === 'v2' && (
                <span className="chip mt-3 bg-[rgb(255_255_255/0.18)] text-white">Points v2</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact icon="target" label="Daily goal">
                {challenge?.stepGoal?.toLocaleString()} steps
              </Fact>
              <Fact icon="bot" label="Bot">
                {challenge?.botName || 'Bot'}
              </Fact>
              <Fact icon="hash" label="Challenge code">
                <span className="font-mono tracking-widest">{challenge?.challengeCode}</span>
              </Fact>
              <Fact icon="calendar-check" label="Weigh-in day">
                {weighIn}
              </Fact>
              <Fact icon="users" label="Participants" className="sm:col-span-2">
                {(challenge?.participants?.length || 0) + 1} people
                <p className="mt-0.5 break-words text-sm font-normal text-ink-muted">
                  {challenge?.creatorEmail && `${challenge.creatorEmail} (Creator)`}
                  {challenge?.participants?.length > 0 && challenge?.creatorEmail && ', '}
                  {challenge?.participants?.join(', ')}
                </p>
              </Fact>
            </div>

            {isAdmin && !isQuitting && (
              <div className="border-t border-line pt-4">
                <h3 className="section-title mb-3 flex items-center gap-2">
                  <Icon name="crown" className="h-4 w-4" />
                  Admin controls
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
                    <Icon name="edit" className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleEndChallenge}
                    className="btn border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  >
                    <Icon name="flag" className="h-4 w-4" />
                    End
                  </button>
                  <button onClick={handleDeleteChallenge} className="btn btn-danger">
                    <Icon name="trash" className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {!isAdmin && !isQuitting && (
              <div className="border-t border-line pt-4">
                <h3 className="section-title mb-3">Participant controls</h3>
                <button onClick={handleLeaveChallenge} className="btn btn-danger w-full">
                  <Icon name="log-out" className="h-4 w-4" />
                  Leave challenge
                </button>
              </div>
            )}

            {isQuitting && (
              <div className="callout callout-warning">
                <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                <p>Deleting challenge. Please wait while we clean up the data.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ChallengeInfoModal 