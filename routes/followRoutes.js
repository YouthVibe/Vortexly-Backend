const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  checkFollowing,
  getSuggestedUsers,
  getFriendBasedSuggestions
} = require('../controllers/followController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// === SPECIFIC ROUTES FIRST ===
// Get suggested users to follow
router.get('/suggested', getSuggestedUsers);

// Get friend-based suggestions (users that your friends follow)
router.get('/friend-suggestions', getFriendBasedSuggestions);

// === PARAMETER ROUTES SECOND ===
// Follow a user - original route
router.post('/:id/follow', followUser);

// Follow a user - direct endpoint to match frontend
router.post('/:id', followUser);

// Unfollow a user - original route
router.delete('/:id/follow', unfollowUser);

// Unfollow a user - direct endpoint to match frontend
router.delete('/:id', unfollowUser);

// Get user's followers
router.get('/:id/followers', getUserFollowers);

// Get users that the user is following
router.get('/:id/following', getUserFollowing);

// Check if the current user is following a specific user
router.get('/:id/check', checkFollowing);

module.exports = router; 