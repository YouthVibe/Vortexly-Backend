const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const { authenticate } = require('../middleware/auth');
const storyController = require('../controllers/storyController');

// Configure file upload
router.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
}));

// All routes require authentication
router.use(authenticate);

// Story routes
router.post('/', storyController.createStory);
router.get('/feed', storyController.getStoriesFeed);
router.get('/user/:userId', storyController.getUserStories);
router.get('/:storyId', storyController.getStory);
router.delete('/:storyId', storyController.deleteStory);
router.post('/:storyId/view', storyController.viewStory);

module.exports = router; 