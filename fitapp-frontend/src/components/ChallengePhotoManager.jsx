import { useState, useContext } from 'react'
import { UserContext } from '../context/UserContext'
import { API_BASE_URL } from '../utils/constants'
import { compressImage } from '../utils/imageCompression'

const ChallengePhotoManager = ({ challenge, onPhotoUpdate, onClose }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { user } = useContext(UserContext)

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

  const removeSelectedPhoto = () => {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    // Reset file input
    const fileInput = document.getElementById('admin-challenge-photo')
    if (fileInput) fileInput.value = ''
  }

  const uploadPhoto = async () => {
    if (!selectedPhoto) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', selectedPhoto)

      const res = await fetch(`${API_BASE_URL}/api/challenge/${challenge._id}/photo`, {
        method: 'PUT',
        body: formData
      })

      if (!res.ok) {
        const errorText = await res.text()
        
        // Check if it's a file size error
        if (errorText.includes('File too large') || errorText.includes('MulterError')) {
          throw new Error('File is too large. Maximum size is 5MB. Please choose a smaller image.')
        }
        
        throw new Error(`Photo upload failed: ${errorText}`)
      }

      const result = await res.json()
      console.log('✅ Photo uploaded successfully:', result)
      
      // Update the challenge with new photo
      if (onPhotoUpdate) {
        onPhotoUpdate({ ...challenge, photo: result.photo })
      }
      
      onClose()
    } catch (err) {
      console.error('❌ Photo upload error:', err)
      alert(`Failed to upload photo: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async () => {
    if (!challenge.photo) return

    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${challenge._id}/photo`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ adminId: user?.sub })
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Photo deletion failed: ${errorText}`)
      }

      const result = await res.json()
      console.log('✅ Photo deleted successfully:', result)
      
      // Update the challenge to remove photo
      if (onPhotoUpdate) {
        onPhotoUpdate({ ...challenge, photo: null })
      }
      
      onClose()
    } catch (err) {
      console.error('❌ Photo deletion error:', err)
      alert(`Failed to delete photo: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Manage Challenge Photo</h2>
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

      {/* Current Photo Display */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Current Photo</h3>
        {challenge.photo ? (
          <div className="relative">
            <img
              src={`${API_BASE_URL}${challenge.photo}`}
              alt={challenge.name}
              className="w-full h-32 object-cover rounded-lg border border-gray-200"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div className="hidden w-full h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
              <span className="text-gray-500">Photo not available</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
            <span className="text-gray-500">No photo set</span>
          </div>
        )}
      </div>

      {/* Photo Upload */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Upload New Photo</h3>
        <div className="space-y-3">
          <input
            id="admin-challenge-photo"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {photoPreview && (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Photo preview"
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={removeSelectedPhoto}
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
            Images will be compressed automatically. Max size: 5MB. Supported formats: JPG, PNG, GIF.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {challenge.photo && (
          <button
            onClick={deletePhoto}
            disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 px-4 rounded-md font-medium transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete Photo'}
          </button>
        )}
        
        <button
          onClick={uploadPhoto}
          disabled={!selectedPhoto || uploading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </button>
        
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ChallengePhotoManager
