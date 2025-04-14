const { cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

/**
 * @desc    Upload user profile image
 * @route   POST /api/upload/profile
 * @access  Private (API key)
 */
const uploadProfileImage = async (req, res) => {
  try {
    // Validate that a file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    // Make sure we have a user from the API key middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get file path
    const filePath = req.file.path;

    try {
      // If user already has a profile image, delete it from Cloudinary
      if (user.profileImageId) {
        try {
          await cloudinary.uploader.destroy(user.profileImageId);
        } catch (cloudinaryError) {
          console.error('Error deleting previous image from Cloudinary:', cloudinaryError);
          // Continue with upload even if deletion fails
        }
      }

      // Upload the image to Cloudinary with Instagram-like optimized settings
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'vortexly/profile-images',
        public_id: `user-${user._id}-${Date.now()}`,
        overwrite: true,
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good', fetch_format: 'auto' }
        ]
      });

      // Update user profile with image URL
      user.profileImage = result.secure_url;
      user.profileImageId = result.public_id;
      await user.save();

      // Remove the temporary file after successful upload
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(200).json({
        message: 'Profile image uploaded successfully',
        profileImage: result.secure_url,
        imageUrl: result.secure_url, // Added for backward compatibility
        user: {
          _id: user._id,
          name: user.name,
          fullName: user.fullName,
          email: user.email,
          profileImage: user.profileImage,
          dob: user.dob,
          isAdult: user.isAdult
        }
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      
      // Remove the temporary file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(500).json({ 
        message: 'Failed to upload image to cloud storage',
        error: cloudinaryError.message
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    
    // Try to clean up any temporary files
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Server error during image upload', 
      error: error.message
    });
  }
};

/**
 * @desc    Delete user profile image
 * @route   DELETE /api/upload/profile
 * @access  Private (API key)
 */
const deleteProfileImage = async (req, res) => {
  try {
    // Make sure we have a user from the API key middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a profile image
    if (!user.profileImageId) {
      return res.status(400).json({ message: 'No profile image to delete' });
    }

    // Delete the image from Cloudinary
    await cloudinary.uploader.destroy(user.profileImageId);

    // Update user profile
    user.profileImage = '';
    user.profileImageId = '';
    await user.save();

    res.status(200).json({
      message: 'Profile image deleted successfully',
      user: {
        _id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        dob: user.dob,
        isAdult: user.isAdult
      }
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get signed URL for client-side upload
 * @route   GET /api/upload/signature
 * @access  Private (API key)
 */
const getUploadSignature = async (req, res) => {
  try {
    // Make sure we have a user from the API key middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp: timestamp,
      folder: 'vortexly/profile-images',
      public_id: `user-${req.user._id}-${Date.now()}`,
      transformation: 'w_500,h_500,c_fill,g_face,q_auto:good'
    };

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder: 'vortexly/profile-images',
      publicId: params.public_id,
      transformation: params.transformation
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  uploadProfileImage,
  deleteProfileImage,
  getUploadSignature
}; 