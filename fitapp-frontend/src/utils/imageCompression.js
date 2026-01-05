import imageCompression from 'browser-image-compression';

/**
 * Compress an image file to stay under the specified size limit
 * @param {File} file - The image file to compress
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @param {number} maxWidthOrHeight - Maximum width or height in pixels (default: 1920)
 * @returns {Promise<File>} - The compressed image file
 */
export const compressImage = async (file, maxSizeMB = 5, maxWidthOrHeight = 1920) => {
  const options = {
    maxSizeMB: maxSizeMB,
    maxWidthOrHeight: maxWidthOrHeight,
    useWebWorker: true,
    fileType: file.type,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image. Please try a different image.');
  }
};

/**
 * Convert a cropped canvas to a File object
 * @param {HTMLCanvasElement} canvas - The canvas element with the cropped image
 * @param {string} fileName - The desired file name
 * @param {string} fileType - The MIME type (default: 'image/jpeg')
 * @param {number} quality - JPEG quality 0-1 (default: 0.9)
 * @returns {Promise<File>} - The file object
 */
export const canvasToFile = async (canvas, fileName, fileType = 'image/jpeg', quality = 0.9) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type: fileType });
          resolve(file);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      fileType,
      quality
    );
  });
};

/**
 * Convert a data URL to a File object
 * @param {string} dataUrl - The data URL string
 * @param {string} fileName - The desired file name (default: 'image.jpg')
 * @returns {Promise<File>} - The file object
 */
export const dataUrlToFile = async (dataUrl, fileName = 'image.jpg') => {
  return new Promise((resolve, reject) => {
    // Convert data URL to blob
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        resolve(file);
      })
      .catch(reject);
  });
};

/**
 * Compress a data URL image (useful for cropped images)
 * @param {string} dataUrl - The image data URL
 * @param {number} maxSizeMB - Maximum file size in MB (default: 0.05 for profile photos)
 * @param {number} maxWidthOrHeight - Maximum width or height in pixels (default: 400)
 * @returns {Promise<string>} - A promise that resolves to the compressed image data URL
 */
export const compressDataUrl = async (dataUrl, maxSizeMB = 0.05, maxWidthOrHeight = 400) => {
  try {
    // Convert data URL to File
    const file = await dataUrlToFile(dataUrl, 'profile-photo.jpg');
    
    // Compress the file
    const compressedFile = await compressImage(file, maxSizeMB, maxWidthOrHeight);
    
    // Convert compressed file back to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    console.error('Error compressing data URL:', error);
    throw new Error('Failed to compress image. Please try a different image.');
  }
};

