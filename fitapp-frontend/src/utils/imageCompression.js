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

