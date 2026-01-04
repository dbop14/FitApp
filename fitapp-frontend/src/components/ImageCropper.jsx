import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg } from '../utils/cropImage';

const ImageCropper = ({ image, onCropComplete, onCancel, aspectRatio = 1 }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(null);

  useEffect(() => {
    // Test if image can be loaded
    if (image) {
      const testImg = new Image();
      testImg.onload = () => {
        setImageLoaded(true);
        setImageError(null);
      };
      testImg.onerror = () => {
        setImageLoaded(false);
        setImageError('Failed to load image');
      };
      testImg.src = image;
    } else {
      setImageLoaded(false);
    }
  }, [image, aspectRatio]);

  const onCropChange = useCallback((croppedArea, croppedAreaPixels) => {
    // Store the latest cropped area pixels
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = useCallback(async () => {
    if (!image || !croppedAreaPixels) return;
    
    setCropping(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setCropping(false);
    }
  }, [image, croppedAreaPixels, onCropComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Crop Your Profile Picture</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={cropping}
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative" style={{ width: '100%', height: '500px', minHeight: '500px' }}>
          {!image ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No image to crop</p>
            </div>
          ) : imageError ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-red-500">Error loading image: {imageError}</p>
            </div>
          ) : !imageLoaded ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading image...</p>
            </div>
          ) : (
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropChange}
              cropShape="round"
              showGrid={false}
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-4">
            {/* Zoom Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                disabled={cropping}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                disabled={cropping || !croppedAreaPixels}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cropping ? 'Processing...' : 'Save Crop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;

