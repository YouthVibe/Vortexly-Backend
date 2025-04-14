const express = require('express');
const router = express.Router();
const { 
  uploadProfileImage, 
  deleteProfileImage,
  getUploadSignature
} = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');

// Protected routes - accepts either JWT token or API key
router.post('/profile', authenticate, upload.single('image'), handleMulterError, uploadProfileImage);
router.delete('/profile', authenticate, deleteProfileImage);
router.get('/signature', authenticate, getUploadSignature);

// Test endpoint for upload functionality
router.post('/test', upload.single('image'), handleMulterError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Get file info
    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    };
    
    // Read the file to confirm it exists and is valid
    const fileExists = fs.existsSync(req.file.path);
    const fileStats = fileExists ? fs.statSync(req.file.path) : null;
    
    // Clean up the file after verification
    if (fileExists) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(200).json({
      message: 'Upload test successful',
      fileInfo,
      fileExists,
      fileSize: fileStats ? fileStats.size : 0,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test upload error:', error);
    
    // Clean up any files
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      message: 'Upload test failed',
      error: error.message
    });
  }
});

module.exports = router; 