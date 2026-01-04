import { useState, useContext, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
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
      // Max size: 0.5MB, Max dimensions: 512x512 (since it's a square crop)
      const compressedDataUrl = await compressDataUrl(croppedImageDataUrl, 0.5, 512)
      
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
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCancelCrop}
          aspectRatio={1}
        />
      )}

      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-center text-white flex-1">
            Account Settings
          </h1>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 pt-20">
          {/* Page header */}
          <div className="mb-6">
            <h1 className={unifiedDesignSystem.typography.hierarchy.pageTitle}>
              Edit Profile
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Picture</h3>
              
              <div className="flex flex-col items-center space-y-4">
                {/* Current/Preview Picture */}
                <div className="relative">
                  <img
                    src={formData.picture || DEFAULT_AVATAR}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                  {formData.picture && (
                    <button
                      type="button"
                      onClick={handleRemovePicture}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      title="Remove picture"
                    >
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex flex-col space-y-2">
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
                    className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-center ${
                      isProcessingImage ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isProcessingImage ? 'Processing...' : 'Choose Photo'}
                  </label>
                  <p className="text-xs text-gray-500 text-center">
                    JPG, PNG or GIF. Images will be compressed and cropped automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Display Name Section */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Display Name</h3>
              
              <div className="space-y-3">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your display name"
                />
                <p className="text-xs text-gray-500">
                  This is the name that will be displayed to other users.
                </p>
              </div>
            </div>

            {/* Error and Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                size="lg"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </>
  )
}

export default AccountSettings
