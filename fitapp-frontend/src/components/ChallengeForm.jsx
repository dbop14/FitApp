import { useState, useEffect, useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { API_BASE_URL } from '../utils/constants'
import { compressImage } from '../utils/imageCompression'

const ChallengeForm = ({ onCreate, onClose }) => {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('20:00')
  const [stepGoal, setStepGoal] = useState(8000)
  const [botName, setBotName] = useState('FitBot')
  const [botAvatar, setBotAvatar] = useState('🤖')
  const [challengeCode, setChallengeCode] = useState('')
  const [weighInDay, setWeighInDay] = useState('monday')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  
  const { user } = useContext(UserContext)

  useEffect(() => {
    const code = 'FIT' + Math.floor(10000 + Math.random() * 90000)
    setChallengeCode(code)
  }, [])

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
    const fileInput = document.getElementById('challenge-photo')
    if (fileInput) fileInput.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const token = localStorage.getItem('fitapp_access_token')
    // Combine date and time for start and end
    const startDateTime = startDate && startTime ? `${startDate}T${startTime}:00` : startDate
    const endDateTime = endDate && endTime ? `${endDate}T${endTime}:00` : endDate

    // Validate that end date/time is not before start date/time
    if (startDateTime && endDateTime) {
      const start = new Date(startDateTime)
      const end = new Date(endDateTime)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert('Please enter valid start and end dates/times.')
        return
      }

      if (end < start) {
        alert('End date and time cannot be before the start date and time. Please adjust your challenge dates.')
        return
      }
    }
    
    const challengeData = {
      name,
      startDate: startDateTime,
      endDate: endDateTime,
      startTime,
      endTime,
      stepGoal,
      botName,
      botAvatar,
      challengeCode,
      isPublic: true, // Default to public
      creatorEmail: user?.email, // Add creator's email for backend
      userGoogleId: user?.sub, // Add creator's Google ID for admin field
      picture: user?.picture, // Add creator's profile picture
      userName: user?.name, // Add creator's actual name
      startingWeight: null, // Starting weight will be set on first weigh-in day
      weighInDay
    }

    console.log('🌐 Sending to:', API_BASE_URL)
    console.log('📤 Challenge data being sent:', challengeData)
    console.log('👤 User data:', {
      email: user?.email,
      name: user?.name,
      sub: user?.sub,
      picture: user?.picture ? 'present' : 'missing'
    })

    try {
      console.log('🚀 Making request to:', `${API_BASE_URL}/api/challenge`)
      
      const res = await fetch(`${API_BASE_URL}/api/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Removed Authorization header since backend doesn't require it
        },
        body: JSON.stringify(challengeData)
      })

      console.log('📥 Response status:', res.status, res.statusText)

      if (!res.ok) {
        const errorText = await res.text()
        console.error('❌ Backend error response:', errorText)
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      const result = await res.json()
      console.log('✅ Challenge saved:', result.challenge)
      
      // If photo was selected, upload it
      let updatedChallenge = result.challenge
      if (selectedPhoto && result.challenge._id) {
        try {
          const photoResult = await uploadChallengePhoto(result.challenge._id, selectedPhoto)
          console.log('✅ Photo uploaded successfully')
          // Update challenge object with photo URL
          updatedChallenge = { ...result.challenge, photo: photoResult }
        } catch (photoError) {
          console.error('❌ Photo upload failed:', photoError)
          // If photo upload fails, delete the challenge and show error
          await fetch(`${API_BASE_URL}/api/challenge/${result.challenge._id}`, {
            method: 'DELETE'
          })
          throw new Error(`Challenge creation failed: ${photoError.message}`)
        }
      }
      
      onCreate(updatedChallenge)
      // Close the modal after successful creation
      onClose()
      
    } catch (err) {
      console.error('❌ Backend error details:', err)
      console.error('❌ Error type:', err.constructor.name)
      console.error('❌ Error message:', err.message)
      
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        alert('Could not reach backend. Please check your internet connection.')
      } else {
        alert(`Error creating challenge: ${err.message}`)
      }
    }
  }

  const uploadChallengePhoto = async (challengeId, photoFile) => {
    try {
      const formData = new FormData()
      formData.append('photo', photoFile)

      const res = await fetch(`${API_BASE_URL}/api/challenge/${challengeId}/photo`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error('❌ Photo upload failed:', errorText)
        
        // Check if it's a file size error
        if (errorText.includes('File too large') || errorText.includes('MulterError')) {
          throw new Error('File is too large. Maximum size is 5MB. Please choose a smaller image.')
        }
        
        throw new Error(`Photo upload failed: ${errorText}`)
      }

      const result = await res.json()
      console.log('✅ Photo uploaded successfully:', result)
      return result.photo
    } catch (err) {
      console.error('❌ Photo upload error:', err)
      throw new Error(`Photo upload failed: ${err.message}`)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-[60] p-4" 
      style={{ alignItems: 'center' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 focus:outline-none scroll-smooth"
        style={{ maxHeight: 'calc(75vh - 6rem)', minHeight: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create a New Challenge</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Challenge Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Photo</label>
              <div className="space-y-3">
                {/* File Input */}
                <input
                  id="challenge-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                
                {/* Photo Preview */}
                {photoPreview && (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Challenge photo preview"
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
                  </div>
                )}
                
                <p className="text-xs text-gray-500">
                  Upload a photo to represent your challenge. Images will be compressed automatically. Max size: 5MB. Supported formats: JPG, PNG, GIF.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Time when challenge starts</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Time when challenge ends</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Step Goal</label>
              <input
                type="number"
                value={stepGoal}
                onChange={(e) => setStepGoal(parseInt(e.target.value))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot Name</label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot Avatar (Emoji or URL)</label>
              <input
                type="text"
                value={botAvatar}
                onChange={(e) => setBotAvatar(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Weigh-in Day</label>
              <select
                value={weighInDay}
                onChange={(e) => setWeighInDay(e.target.value)}
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
              <p className="text-sm text-gray-600 mt-1">
                The bot will remind everyone to weigh in on this day
              </p>
            </div>


            <div className="bg-gray-100 p-2 text-center rounded text-sm text-gray-600">
              Challenge Code: <span className="font-mono">{challengeCode}</span>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold shadow"
            >
              Start Challenge
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChallengeForm