const express = require('express');
const router = express.Router({mergeParams: true});
const commentsController = require('../controllers/commentsController');
const { protect } = require('../middleware/auth');

// Get comments for a post
router.get('/', commentsController.getComments);

// Get popular comments for a post
router.get('/popular', commentsController.getPopularComments);

// Add a comment to a post (requires authentication)
router.post('/', protect, commentsController.addComment);

// Like or unlike a comment (requires authentication)
router.post('/:commentId/like', protect, commentsController.likeComment);

// Add a reply to a comment (requires authentication)
router.post('/:commentId/reply', protect, commentsController.addReply);

// Pin or unpin a comment (requires authentication)
router.post('/:commentId/pin', protect, commentsController.pinComment);

// Like or unlike a reply (requires authentication)
router.post('/:commentId/replies/:replyId/like', protect, commentsController.likeReply);

module.exports = router; 