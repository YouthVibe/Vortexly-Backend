const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const { protect } = require('../middleware/authMiddleware');
const reelController = require('../controllers/reelController');

// Configure file upload
router.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
}));

// Reel routes
router.post('/', protect, reelController.createReel);
router.get('/', reelController.getReels);
router.get('/user/:userId', reelController.getUserReels);
router.get('/:id', reelController.getReel);
router.delete('/:id', protect, reelController.deleteReel);
router.post('/:id/like', protect, reelController.toggleLike);
router.post('/:id/comments', protect, reelController.addComment);
router.get('/:id/comments', reelController.getComments);
router.delete('/:id/comments/:commentId', protect, reelController.deleteComment);

// New comment interaction routes
router.post('/:id/comments/:commentId/like', protect, reelController.toggleCommentLike);
router.post('/:id/comments/:commentId/reply', protect, reelController.addCommentReply);
router.post('/:id/comments/:commentId/replies/:replyId/like', protect, reelController.toggleReplyLike);

module.exports = router; 