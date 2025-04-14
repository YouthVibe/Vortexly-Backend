const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const searchController = require('../controllers/searchController');

// Search routes
router.get('/', optionalAuth, searchController.search);
router.get('/users', optionalAuth, searchController.searchUsers);
router.get('/posts', searchController.searchPosts);
router.get('/reels', searchController.searchReels);
router.get('/songs', searchController.searchSongs);

// Route for suggested accounts - requires authentication
router.get('/suggested-accounts', protect, searchController.getSuggestedAccounts);

// Add a new route for Gemini search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }
    
    const suggestions = await searchController.getSearchSuggestions(query);
    
    return res.status(200).json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting search suggestions',
      error: error.message
    });
  }
});

module.exports = router; 