/**
 * Creates a cropped image from the source image
 * @param {string} imageSrc - The source image URL or data URL
 * @param {Object} pixelCrop - The crop area in pixels { x, y, width, height }
 * @returns {Promise<string>} - A promise that resolves to the cropped image data URL
 */
export const getCroppedImg = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Validate crop dimensions
      if (!pixelCrop || pixelCrop.width <= 0 || pixelCrop.height <= 0) {
        reject(new Error('Invalid crop dimensions'));
        return;
      }

      // Set canvas size to the cropped area
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      // Draw the cropped image
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      // Convert to blob and then to data URL
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.95
      );
    };

    image.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
};

