const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Upload file to Cloudinary with improved error handling and timeout
const uploadToCloudinary = async (file, isFilePath = false, folder = 'posts') => {
  try {
    if (!file) {
      throw new Error('Invalid file provided');
    }

    // Handle both file objects and direct file paths
    let filePath;
    let fileName;
    
    if (isFilePath) {
      // If a direct file path is provided
      filePath = file;
      fileName = filePath.split('/').pop();
      console.log(`Uploading file to Cloudinary from path: ${filePath}`);
      
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }
    } else {
      // If a file object is provided
      if (!file.tempFilePath) {
        throw new Error('Invalid file object provided (missing tempFilePath)');
      }
      filePath = file.tempFilePath;
      fileName = file.name || 'unknown';
      console.log(`Uploading file to Cloudinary: ${fileName}`);
    }
    
    // Use more efficient parameters for faster uploads
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto:low' }, // Use lower quality to reduce file size
        { fetch_format: 'auto' }
      ],
      timeout: 120000, // 2 minutes
      eager: [
        { width: 1200, height: 1200, crop: "limit" } // Resize to reasonable dimensions
      ],
      eager_async: true,
      eager_notification_url: null,
    });
    
    console.log(`Upload successful: ${result.public_id}`);
    
    // Clean up the temp file to free up server space (but only if it's a file object, not for user-provided file paths)
    if (!isFilePath) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted temp file: ${filePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
        // Non-critical error, continue execution
      }
    }
    
    return result;
  } catch (error) {
    console.error('Cloudinary upload error details:', error);
    
    // Clean up the temp file even on error (but only if it's a file object)
    if (!isFilePath && file && file.tempFilePath && fs.existsSync(file.tempFilePath)) {
      try {
        fs.unlinkSync(file.tempFilePath);
        console.log(`Deleted temp file after error: ${file.tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file after error:', cleanupError);
      }
    }
    
    if (error.http_code === 499 || error.message && error.message.includes('timeout')) {
      throw new Error('Upload timeout. Please try with a smaller file or check your internet connection.');
    }
    
    throw new Error(`Error uploading file to Cloudinary: ${error.message || 'Unknown error'}`);
  }
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      console.log('No public ID provided for deletion, skipping');
      return { result: 'skipped' };
    }
    
    console.log(`Deleting file from Cloudinary: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Deletion result: ${result.result}`);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error details:', error);
    throw new Error(`Error deleting file from Cloudinary: ${error.message || 'Unknown error'}`);
  }
};

// Upload video to Cloudinary with improved error handling and timeout
const uploadVideoToCloudinary = async (file, folder = 'reels') => {
  try {
    if (!file || !file.tempFilePath) {
      throw new Error('Invalid video file provided');
    }

    console.log(`Uploading video to Cloudinary: ${file.name || 'unknown'}`);
    
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder,
      resource_type: 'video',
      chunk_size: 10000000, // 10MB chunks for faster upload
      timeout: 300000, // 5 minutes timeout for videos
      eager: [
        { format: "mp4", quality: "auto" }
      ],
      eager_async: true,
      eager_notification_url: null,
      transformation: [
        { quality: "auto:low" },
        { fetch_format: "mp4" }
      ]
    });
    
    console.log(`Video upload successful: ${result.public_id}`);
    
    // Clean up the temp file
    try {
      fs.unlinkSync(file.tempFilePath);
      console.log(`Deleted temp video file: ${file.tempFilePath}`);
    } catch (cleanupError) {
      console.error('Error cleaning up temp video file:', cleanupError);
    }
    
    return result;
  } catch (error) {
    console.error('Cloudinary video upload error details:', error);
    
    // Clean up the temp file even on error
    try {
      if (file && file.tempFilePath && fs.existsSync(file.tempFilePath)) {
        fs.unlinkSync(file.tempFilePath);
        console.log(`Deleted temp video file after error: ${file.tempFilePath}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp video file after error:', cleanupError);
    }
    
    if (error.http_code === 499 || error.message && error.message.includes('timeout')) {
      throw new Error('Video upload timeout. Please try with a smaller video or check your internet connection.');
    }
    
    throw new Error(`Error uploading video to Cloudinary: ${error.message || 'Unknown error'}`);
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadVideoToCloudinary
}; 