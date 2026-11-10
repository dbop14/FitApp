import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg } from '../utils/cropImage';
import Icon from './ui/Icon';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-0 sm:p-4">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border border-line bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-5 py-4 safe-area-header sm:pt-4">
          <h2 className="text-lg font-semibold text-ink">Crop your profile picture</h2>
          <button
            onClick={onCancel}
            className="icon-btn -mr-2"
            disabled={cropping}
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Cropper Container - Scrollable */}
        <div className="relative flex-1 overflow-auto" style={{ width: '100%', minHeight: '400px' }}>
          {!image ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-ink-muted">No image to crop</p>
            </div>
          ) : imageError ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-red-600">Error loading image: {imageError}</p>
            </div>
          ) : !imageLoaded ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-ink-muted">Loading image...</p>
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

        {/* Controls - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-line bg-surface px-5 py-4 pb-[calc(1rem+var(--safe-area-bottom))]">
          <div className="space-y-4">
            {/* Zoom Control */}
            <div>
              <label className="label">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={cropping}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                disabled={cropping || !croppedAreaPixels}
                className="btn btn-primary flex-1"
              >
                {cropping ? 'Processing...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;

