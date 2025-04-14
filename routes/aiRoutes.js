const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// Generate an AI profile image
router.post('/generate-image', protect, aiController.generateImage);

// Delete an image from Cloudinary
router.delete('/delete-image', protect, aiController.deleteImage);

// Analyze image content
router.post('/analyze-image', protect, aiController.analyzeImage);

// Generate caption for images
router.post('/generate-caption', protect, aiController.generateCaption);

// Generate tags for post
router.post('/generate-tags', protect, aiController.generateTags);

module.exports = router; 