const User = require('../models/User');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const { validateObjectId } = require('../utils/validation');
const axios = require('axios');
require('dotenv').config();

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Main search endpoint - searches across multiple entities
exports.search = async (req, res) => {
  try {
    const { query, type = 'all', page = 1, limit = 20 } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const searchQuery = query.trim();
    
    // Initialize response object
    const response = {
      users: [],
      posts: [],
      reels: [],
      songs: []
    };
    
    const searchPromises = [];
    
    // Only search requested types or all if not specified
    if (type === 'all' || type === 'users') {
      searchPromises.push(
        User.find({ 
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { fullName: { $regex: searchQuery, $options: 'i' } },
            { bio: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .select('_id name fullName avatar followers posts reels')
        .sort({ followers: -1 })
        .limit(type === 'all' ? 5 : limitNumber)
        .lean()
        .then(users => {
          response.users = users;
        })
      );
    }
    
    if (type === 'all' || type === 'posts') {
      searchPromises.push(
        Post.find({
          $or: [
            { caption: { $regex: searchQuery, $options: 'i' } },
            { tags: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .populate('user', '_id name fullName avatar')
        .select('_id image caption tags createdAt likes comments')
        .sort({ createdAt: -1 })
        .limit(type === 'all' ? 5 : limitNumber)
        .lean()
        .then(posts => {
          response.posts = posts;
        })
      );
    }
    
    if (type === 'all' || type === 'reels') {
      searchPromises.push(
        Reel.find({
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { caption: { $regex: searchQuery, $options: 'i' } },
            { tags: { $regex: searchQuery, $options: 'i' } }
          ],
          isPrivate: false
        })
        .populate('user', '_id name fullName avatar')
        .select('_id videoUrl thumbnailUrl title caption tags views likes comments duration')
        .sort({ views: -1 })
        .limit(type === 'all' ? 5 : limitNumber)
        .lean()
        .then(reels => {
          response.reels = reels;
        })
      );
    }
    
    if (type === 'all' || type === 'songs') {
      // Note: This is a mock implementation since we don't have a Song model
      // In a real app, you would search the Song collection
      response.songs = [];
    }
    
    // Wait for all search operations to complete
    await Promise.all(searchPromises);
    
    // Add isFollowing flag to users if a user is logged in
    if (req.user && (type === 'all' || type === 'users') && response.users.length > 0) {
      const currentUser = await User.findById(req.user._id).select('followingRef');
      
      if (currentUser && currentUser.followingRef) {
        // Convert ObjectId to string for easier comparison
        const followingIds = currentUser.followingRef.map(id => id.toString());
        
        // Add isFollowing flag to each user
        response.users.forEach(user => {
          user.isFollowing = followingIds.includes(user._id.toString());
        });
      }
    }
    
    // Calculate total
    const total = response.users.length + response.posts.length + response.reels.length + response.songs.length;
    
    res.status(200).json({
      success: true,
      data: response,
      total
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      message: 'Error performing search',
      error: error.message
    });
  }
};

// Search users only
exports.searchUsers = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const searchQuery = query.trim();
    
    // Count total matching users for pagination
    const total = await User.countDocuments({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { bio: { $regex: searchQuery, $options: 'i' } }
      ]
    });
    
    // Find users matching the query
    const users = await User.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { bio: { $regex: searchQuery, $options: 'i' } }
      ]
    })
    .select('_id name fullName avatar bio followers following posts reels')
    .sort({ followers: -1 })
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber)
    .lean();
    
    // Check if the current user is following each user in the results
    if (req.user) {
      const currentUser = await User.findById(req.user._id).select('followingRef');
      
      if (currentUser && currentUser.followingRef) {
        // Convert ObjectId to string for easier comparison
        const followingIds = currentUser.followingRef.map(id => id.toString());
        
        // Add isFollowing flag to each user
        users.forEach(user => {
          user.isFollowing = followingIds.includes(user._id.toString());
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      message: 'Error searching users',
      error: error.message
    });
  }
};

// Search posts only
exports.searchPosts = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const searchQuery = query.trim();
    
    // Count total matching posts for pagination
    const total = await Post.countDocuments({
      $or: [
        { caption: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } }
      ]
    });
    
    // Find posts matching the query
    const posts = await Post.find({
      $or: [
        { caption: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } }
      ]
    })
    .populate('user', '_id name fullName avatar')
    .select('_id image caption tags createdAt likes comments')
    .sort({ createdAt: -1 })
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber)
    .lean();
    
    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({
      message: 'Error searching posts',
      error: error.message
    });
  }
};

// Search reels only
exports.searchReels = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const searchQuery = query.trim();
    
    // Count total matching reels for pagination
    const total = await Reel.countDocuments({
      $or: [
        { title: { $regex: searchQuery, $options: 'i' } },
        { caption: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } }
      ],
      isPrivate: false
    });
    
    // Find reels matching the query
    const reels = await Reel.find({
      $or: [
        { title: { $regex: searchQuery, $options: 'i' } },
        { caption: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } }
      ],
      isPrivate: false
    })
    .populate('user', '_id name fullName avatar')
    .select('_id videoUrl thumbnailUrl title caption tags views likes comments duration audioTrack')
    .sort({ views: -1 })
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber)
    .lean();
    
    res.status(200).json({
      success: true,
      data: reels,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Search reels error:', error);
    res.status(500).json({
      message: 'Error searching reels',
      error: error.message
    });
  }
};

// Search songs (mock implementation)
exports.searchSongs = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Mock implementation - in a real app, you would search your Songs collection
    const mockSongs = [
      { id: '1', title: 'Summer Vibes', artist: 'DJ Cool', duration: '3:30', audioUrl: '/audio/summer-vibes.mp3' },
      { id: '2', title: 'Chill Mode', artist: 'Lofi Beats', duration: '2:45', audioUrl: '/audio/chill-mode.mp3' },
      { id: '3', title: 'Dance Party', artist: 'EDM Master', duration: '4:15', audioUrl: '/audio/dance-party.mp3' },
    ];
    
    // Filter mock songs based on query
    const searchQuery = query.trim().toLowerCase();
    const results = mockSongs.filter(song => 
      song.title.toLowerCase().includes(searchQuery) || 
      song.artist.toLowerCase().includes(searchQuery)
    );
    
    res.status(200).json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('Search songs error:', error);
    res.status(500).json({
      message: 'Error searching songs',
      error: error.message
    });
  }
};

// Get suggested accounts to follow
exports.getSuggestedAccounts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNumber = parseInt(limit, 10);
    
    // Get current user
    const currentUser = await User.findById(req.user._id).select('followingRef');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the list of users to exclude (following + self)
    const followingIds = currentUser.followingRef.map(id => id.toString());
    const excludeIds = [...followingIds, req.user._id.toString()];
    
    // Find suggested users based on popularity (follower count)
    // Exclude users the current user already follows and themselves
    const suggestedUsers = await User.find({
      _id: { $nin: excludeIds }
    })
    .select('_id name fullName avatar bio followers posts')
    .sort({ followers: -1 }) // Sort by popularity
    .limit(limitNumber)
    .lean();
    
    res.status(200).json({
      success: true,
      data: suggestedUsers
    });
  } catch (error) {
    console.error('Get suggested accounts error:', error);
    res.status(500).json({
      message: 'Error fetching suggested accounts',
      error: error.message
    });
  }
};

// Get search suggestions from Gemini API
exports.getSearchSuggestions = async (query, maxResults = 5) => {
  try {
    // Check if API key is available
    if (!GEMINI_API_KEY) {
      console.warn('No Gemini API key found in environment variables');
      return [];
    }

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate ${maxResults} search suggestions for the query: "${query.trim()}". 
                Return only a JSON array of strings with no additional text or explanation.
                For example, if the input is "react", return something like:
                ["react native", "react js", "react hooks", "react tutorial", "react router"]`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 200,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      }
    );

    if (response.data && response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
      const text = response.data.candidates[0].content.parts[0].text;
      
      // Try to extract JSON array from the response
      try {
        // Find brackets and parse JSON
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const suggestions = JSON.parse(match[0]);
          return Array.isArray(suggestions) ? suggestions : [];
        }
        return [];
      } catch (parseError) {
        console.error('Error parsing Gemini suggestions:', parseError);
        return [];
      }
    }
    
    return [];
  } catch (error) {
    // Enhanced error logging to diagnose the issue
    if (error.response) {
      console.error('Gemini API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('No response received from Gemini API:', error.message);
    } else {
      console.error('Error setting up Gemini API request:', error.message);
    }
    
    // Return empty array instead of propagating the error
    return [];
  }
}; 