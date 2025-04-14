const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const { authenticate } = require('../middleware/auth');
const {
  createPost,
  getUserPosts,
  getPost,
  deletePost,
  toggleLike,
  addComment,
  getAllPosts,
  toggleCommentLike,
  addCommentReply,
  toggleReplyLike,
  toggleBookmark,
  getBookmarkedPosts,
  getBookmarkedPostIds,
  cancelUpload,
  uploadTempImage,
  createPostFromTemp,
  cleanupTempFiles,
  getLikeStatus,
  getBookmarkStatus,
  getPostLikes
} = require('../controllers/postController');

// Configure file upload
router.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  abortOnLimit: false,
  responseOnLimit: 'File size limit has been reached',
  debug: true, // Enable debug for troubleshooting
  safeFileNames: true,
  preserveExtension: true,
  createParentPath: true,
  parseNested: true
}));

// All routes require authentication
router.use(authenticate);

// Post routes
router.post('/', createPost);
router.get('/', getAllPosts);
router.get('/user/:userId', getUserPosts);
router.get('/bookmarks', getBookmarkedPosts);
router.get('/bookmarked-ids', getBookmarkedPostIds);
router.get('/:postId', getPost);
router.get('/:postId/like/status', getLikeStatus);
router.get('/:postId/likes', getPostLikes);
router.get('/:postId/bookmark/status', getBookmarkStatus);
router.delete('/:postId', deletePost);
router.post('/:postId/like', toggleLike);
router.post('/:postId/bookmark', toggleBookmark);

// Temporary upload routes
router.post('/temp/upload', uploadTempImage);
router.post('/temp/create', createPostFromTemp);
router.post('/temp/cleanup', cleanupTempFiles);

// Add the cancel upload route with authentication middleware
router.post('/cancel-upload', cancelUpload);

// Test endpoint for upload diagnostics
router.post('/test-upload', (req, res) => {
  try {
    console.log('Test upload endpoint hit');
    console.log('Files received:', req.files ? Object.keys(req.files).length : 'No files');
    console.log('Body fields:', Object.keys(req.body).length);
    
    if (req.files) {
      // Log info about each file
      Object.keys(req.files).forEach(fieldName => {
        const files = Array.isArray(req.files[fieldName]) 
          ? req.files[fieldName] 
          : [req.files[fieldName]];
        
        files.forEach((file, index) => {
          console.log(`File ${index + 1} in ${fieldName}:`, {
            name: file.name,
            size: file.size,
            mimetype: file.mimetype
          });
        });
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Upload test received',
      filesCount: req.files ? Object.keys(req.files).length : 0,
      bodyFields: Object.keys(req.body)
    });
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 