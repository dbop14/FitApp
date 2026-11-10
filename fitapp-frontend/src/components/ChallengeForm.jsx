import { useState, useEffect, useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { API_BASE_URL } from '../utils/constants'
import { compressImage } from '../utils/imageCompression'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

const ChallengeForm = ({ onCreate, onClose }) => {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('20:00')
  const [stepGoal, setStepGoal] = useState(8000)
  const [botName, setBotName] = useState('FitBot')
  // Bot avatar is no longer chosen in the UI (the app shows a bot icon); the backend keeps its default.
  const botAvatar = undefined
  const [challengeCode, setChallengeCode] = useState('')
  const [weighInDay, setWeighInDay] = useState('monday')
  const [scoringMode, setScoringMode] = useState('classic')
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
      weighInDay,
      scoringMode
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
      onClose?.()
      
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
    <Modal
      isOpen
      onClose={onClose}
      title="Create a challenge"
      icon="trophy"
      footer={
        <>
          {onClose && (
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          )}
          <button type="submit" form="challenge-form" className="btn btn-primary">
            <Icon name="flag" className="h-4 w-4" />
            Start challenge
          </button>
        </>
      }
    >
      <form id="challenge-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="cf-name">Challenge name</label>
          <input id="cf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="challenge-photo">Challenge photo</label>
          <div className="space-y-3">
            {photoPreview && (
              <div className="relative">
                <img src={photoPreview} alt="Challenge photo preview" className="h-32 w-full rounded-xl border border-line object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove photo"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              id="challenge-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-ink"
            />
            <p className="text-xs text-ink-muted">Optional. Compressed automatically. Max 5MB. JPG, PNG or GIF.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cf-start">Start date</label>
            <input id="cf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cf-end">End date</label>
            <input id="cf-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cf-start-time">Start time</label>
            <input id="cf-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cf-end-time">End time</label>
            <input id="cf-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </div>
        </div>

        <fieldset>
          <legend className="label">Scoring</legend>
          <div className="grid grid-cols-1 gap-2">
            {[
              { value: 'classic', title: 'Classic', icon: 'target', text: 'Points for each day you reach the step goal, plus weight-loss points at the end.' },
              { value: 'v2', title: 'Points v2', icon: 'sparkles', text: 'Points for steps, a daily goal bonus, workouts (Effort Points), strength sessions, a weekly consistency bonus and weight loss. Each member\'s data source is locked when they join.' },
            ].map((opt) => {
              const selected = scoringMode === opt.value
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    selected ? 'border-blue-500 bg-brand-soft' : 'border-line hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="radio"
                    name="scoringMode"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setScoringMode(opt.value)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-surface-2 text-ink-muted'}`}>
                    <Icon name={opt.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{opt.title}</span>
                    <span className="block text-xs text-ink-muted">{opt.text}</span>
                  </span>
                  <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-line-strong'}`}>
                    {selected && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cf-goal">Daily step goal</label>
            <input id="cf-goal" type="number" inputMode="numeric" value={stepGoal} onChange={(e) => setStepGoal(parseInt(e.target.value))} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cf-bot">Bot name</label>
            <input id="cf-bot" type="text" value={botName} onChange={(e) => setBotName(e.target.value)} required className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cf-weighin">Weekly weigh-in day</label>
          <select id="cf-weighin" value={weighInDay} onChange={(e) => setWeighInDay(e.target.value)} className="input">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-muted">The bot reminds everyone to weigh in on this day.</p>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
          <span className="text-ink-muted">Challenge code</span>
          <span className="font-mono font-semibold tracking-widest text-ink">{challengeCode}</span>
        </div>
      </form>
    </Modal>
  )
}

export default ChallengeForm