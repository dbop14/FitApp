import { useState, useContext, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { DEFAULT_AVATAR } from '../utils/constants'
import ImageCropper from '../components/ImageCropper'
import { compressImage, compressDataUrl } from '../utils/imageCompression'

const AccountSettings = () => {
  const { user, updateUserProfile } = useContext(UserContext)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    picture: user?.picture || ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCropper, setShowCropper] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [isProcessingImage, setIsProcessingImage] = useState(false)

  // Sync formData with user when user loads (only if formData is still empty/initial)
  useEffect(() => {
    if (user) {
      setFormData(prev => {
        // Only update if current values are empty (initial state) - don't overwrite user edits
        const needsNameUpdate = !prev.name && user.name
        const needsPictureUpdate = !prev.picture && user.picture
        if (needsNameUpdate || needsPictureUpdate) {
          return {
            name: user.name || prev.name || '',
            picture: user.picture || prev.picture || ''
          }
        }
        return prev
      })
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePictureChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    setIsProcessingImage(true)
    setError('')

    try {
      // Compress the image first to reduce file size
      const compressedFile = await compressImage(file, 5, 1920)
      
      // Read the compressed file as data URL for cropping
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target.result
        setImageToCrop(dataUrl)
        setShowCropper(true)
        setIsProcessingImage(false)
      }
      reader.onerror = () => {
        setError('Failed to read image file')
        setIsProcessingImage(false)
      }
      reader.readAsDataURL(compressedFile)
    } catch (err) {
      setError(err.message || 'Failed to process image. Please try a different image.')
      setIsProcessingImage(false)
    }
  }

  const handleCropComplete = async (croppedImageDataUrl) => {
    setIsProcessingImage(true)
    setError('')
    
    try {
      // Compress the cropped image with aggressive settings for profile photos
      // Max size: 0.05MB (50KB) to account for base64 overhead (~33%) = ~67KB data URL
      // This ensures we stay well under the 100KB server limit
      // Max dimensions: 400x400 (smaller for profile photos)
      const compressedDataUrl = await compressDataUrl(croppedImageDataUrl, 0.05, 400)
      
      setFormData(prev => ({
        ...prev,
        picture: compressedDataUrl
      }))
      setShowCropper(false)
      setImageToCrop(null)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err.message || 'Failed to compress cropped image. Please try again.')
      console.error('Error compressing cropped image:', err)
    } finally {
      setIsProcessingImage(false)
    }
  }

  const handleCancelCrop = () => {
    setShowCropper(false)
    setImageToCrop(null)
    setIsProcessingImage(false)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      await updateUserProfile(formData)
      setSuccess('Profile updated successfully!')
      setTimeout(() => {
        navigate('/settings')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemovePicture = () => {
    setFormData(prev => ({
      ...prev,
      picture: ''
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleBack = () => {
    navigate('/settings')
  }

  return (
    <>
      {/* Image Cropper Modal */}
      {showCropper && imageToCrop && (
        <ImageCropper image={imageToCrop} onCropComplete={handleCropComplete} onCancel={handleCancelCrop} aspectRatio={1} />
      )}

      <PageHeader title="Account" subtitle="Edit your profile" back={handleBack} />

      <div className="page-narrow">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile picture */}
          <section className="card card-pad" aria-labelledby="acct-photo">
            <h2 id="acct-photo" className="card-title mb-4">Profile picture</h2>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <img
                  src={formData.picture || DEFAULT_AVATAR}
                  alt="Profile"
                  className="h-24 w-24 rounded-full border-4 border-line object-cover"
                />
                {formData.picture && (
                  <button
                    type="button"
                    onClick={handleRemovePicture}
                    className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                    title="Remove picture"
                    aria-label="Remove picture"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 sm:items-start">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureChange}
                  className="hidden"
                  id="profile-picture"
                  disabled={isProcessingImage}
                />
                <label
                  htmlFor="profile-picture"
                  className={`btn btn-secondary cursor-pointer ${isProcessingImage ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Icon name="camera" className="h-4 w-4" />
                  {isProcessingImage ? 'Processing...' : 'Choose photo'}
                </label>
                <p className="text-center text-xs text-ink-muted sm:text-left">
                  JPG, PNG or GIF. Images are compressed and cropped automatically.
                </p>
              </div>
            </div>
          </section>

          {/* Display name */}
          <section className="card card-pad" aria-labelledby="acct-name">
            <h2 id="acct-name" className="card-title mb-4">Display name</h2>
            <label htmlFor="name" className="label">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="input"
              placeholder="Enter your display name"
            />
            <p className="mt-1.5 text-xs text-ink-muted">This is the name other members see.</p>
          </section>

          {error && (
            <div className="callout callout-danger" role="alert">
              <Icon name="alert-circle" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="callout callout-success" role="status">
              <Icon name="check-circle" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={handleBack} size="lg">
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="lg" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

export default AccountSettings
