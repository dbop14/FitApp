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
  // #region agent log
  const inputSizeBytes = dataUrl ? Math.round((dataUrl.length * 3) / 4) : 0;
  fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:78',message:'compressDataUrl entry',data:{inputDataUrlLength:dataUrl?.length,inputSizeBytes,inputSizeMB:(inputSizeBytes/1024/1024).toFixed(2),maxSizeMB,maxWidthOrHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    // Convert data URL to File
    const file = await dataUrlToFile(dataUrl, 'profile-photo.jpg');
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:82',message:'After dataUrlToFile',data:{fileSize:file.size,fileSizeMB:(file.size/1024/1024).toFixed(2),fileType:file.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Compress the file
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:85',message:'Before compressImage call',data:{maxSizeMB,maxWidthOrHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    const compressedFile = await compressImage(file, maxSizeMB, maxWidthOrHeight);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:87',message:'After compressImage call',data:{compressedFileSize:compressedFile.size,compressedFileSizeMB:(compressedFile.size/1024/1024).toFixed(2),compressionRatio:((1-compressedFile.size/file.size)*100).toFixed(1)+'%',meetsMaxSize:compressedFile.size<=maxSizeMB*1024*1024},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    // Convert compressed file back to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // #region agent log
        const outputDataUrlLength = reader.result?.length || 0;
        const outputSizeBytes = Math.round((outputDataUrlLength * 3) / 4);
        fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:94',message:'compressDataUrl exit',data:{outputDataUrlLength,outputSizeBytes,outputSizeMB:(outputSizeBytes/1024/1024).toFixed(2),finalCompressionRatio:((1-outputSizeBytes/inputSizeBytes)*100).toFixed(1)+'%'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompression.js:100',message:'Error in compressDataUrl',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error compressing data URL:', error);
    throw new Error('Failed to compress image. Please try a different image.');
  }
};

