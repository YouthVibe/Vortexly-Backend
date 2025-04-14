const { getPostComments, addComment, togglePinComment, likeComment, updatePopularComments } = require('../utils/commentUtils');
const Post = require('../models/Post');
const User = require('../models/User');
const mongoose = require('mongoose');
const PostComment = require('../models/PostComment');

/**
 * Get comments for a post
 * @route GET /api/comments/:postId
 * @access Private
 */
const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 10, skip = 0, sortBy = 'newest' } = req.query;

    // Validate sortBy parameter
    const validSortOptions = ['newest', 'oldest', 'popular'];
    if (!validSortOptions.includes(sortBy)) {
      return res.status(400).json({ error: 'Invalid sort option' });
    }

    const comments = await getPostComments(postId, parseInt(limit), parseInt(skip), sortBy);

    // Transform comments to include user data
    const transformComments = async (comments) => {
      return Promise.all(comments.map(async (comment) => {
        try {
          const user = await User.findById(comment.user).select('username profilePicture');
          
          // Handle case where user might not be found
          const userData = user ? {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture
          } : {
            _id: comment.user,
            username: 'Unknown User',
            profilePicture: null
          };
          
          return {
            ...comment,
            user: userData
          };
        } catch (error) {
          console.error('Error fetching user for comment:', error);
          // Return comment with default user data if there's an error
          return {
            ...comment,
            user: {
              _id: comment.user,
              username: 'Unknown User',
              profilePicture: null
            }
          };
        }
      }));
    };

    const transformedComments = {
      pinned: await transformComments(comments.pinned),
      popular: await transformComments(comments.popular),
      regular: await transformComments(comments.regular),
      total: comments.total
    };

    res.json(transformedComments);
  } catch (error) {
    console.error('Error in getComments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

/**
 * Add a comment to a post
 * @route POST /api/comments/:postId
 * @access Private
 */
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    const userId = req.user._id;
    
    const newComment = await addComment(postId, {
      user: userId,
      text: text.trim()
    });
    
    // Get user data to return with the comment
    let userData;
    try {
      const user = await User.findById(userId).select('username profilePicture name');
      
      // Handle case where user might not be found
      userData = user ? {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        name: user.name
      } : {
        _id: userId,
        username: 'Unknown User',
        profilePicture: null,
        name: 'Unknown'
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      userData = {
        _id: userId,
        username: 'Unknown User',
        profilePicture: null,
        name: 'Unknown'
      };
    }
    
    // Return the comment with user data
    res.status(201).json({
      success: true,
      data: {
        ...newComment,
        user: userData
      }
    });
  } catch (error) {
    console.error('Error in createComment controller:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Pin/unpin a comment
 * @route PUT /api/comments/:postId/pin/:commentId
 * @access Private
 */
const pinComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    // Verify post ownership
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only post owner can pin comments' });
    }

    const result = await togglePinComment(postId, commentId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in pinComment controller:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Like/unlike a comment
 * @route PUT /api/comments/:postId/like/:commentId
 * @access Private
 */
const likeUnlikeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const result = await likeComment(postId, commentId, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in likeUnlikeComment controller:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get comments from PostComment collection for a specific post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPostCommentStorage = async (req, res) => {
  try {
    const { postId } = req.params;
    const { block = -1 } = req.query; // Default to -1 to get the last block
    
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if post has any comments
    if (!post.comments || post.comments.length === 0) {
      return res.status(200).json({ 
        comments: [],
        popularComments: [],
        total: 0,
        blockNumber: 0,
        totalBlocks: 0
      });
    }
    
    // Determine which block to fetch
    let blockNumber = parseInt(block);
    const totalBlocks = post.comments.length;
    
    // If block is -1 or greater than total blocks, get the last block
    if (blockNumber === -1 || blockNumber >= totalBlocks) {
      blockNumber = totalBlocks - 1;
    }
    
    // Get the PostComment document ID for the specified block
    const commentDocId = post.comments[blockNumber];
    
    // Find the PostComment document
    const postCommentDoc = await PostComment.findById(commentDocId);
    if (!postCommentDoc) {
      return res.status(404).json({ error: 'Comment document not found' });
    }
    
    // Transform comments to include user data
    const transformComments = async (comments) => {
      const transformedComments = [];
      
      for (const comment of comments) {
        try {
          const user = await User.findById(comment.user).select('username profilePicture');
          
          // Handle case where user might not be found
          const userData = user ? {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture
          } : {
            _id: comment.user,
            username: 'Unknown User',
            profilePicture: null
          };
          
          transformedComments.push({
            _id: comment.commentID,
            user: userData,
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        } catch (error) {
          console.error('Error fetching user for comment:', error);
          // Add comment with default user data if there's an error
          transformedComments.push({
            _id: comment.commentID,
            user: {
              _id: comment.user,
              username: 'Unknown User',
              profilePicture: null
            },
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        }
      }
      
      return transformedComments;
    };
    
    // Transform regular comments
    const transformedComments = await transformComments(postCommentDoc.comments);
    
    // Transform popular comments
    const transformedPopularComments = await transformComments(postCommentDoc.popularComments);
    
    // Return the comments
    return res.status(200).json({
      comments: transformedComments,
      popularComments: transformedPopularComments,
      total: post.commentsCount || 0,
      blockNumber,
      totalBlocks,
      hasNextBlock: blockNumber < totalBlocks - 1,
      hasPrevBlock: blockNumber > 0
    });
    
  } catch (error) {
    console.error('Error in getPostCommentStorage:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

/**
 * Get comment block IDs for a post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCommentBlockIds = async (req, res) => {
  try {
    const { postId } = req.params;
    const { index } = req.query;
    
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if post has any comments
    if (!post.comments || post.comments.length === 0) {
      return res.status(200).json({ 
        comments: [],
        popularComments: [],
        total: 0,
        blockIndex: 0,
        totalBlocks: 0
      });
    }
    
    // Determine which block to fetch
    let blockIndex = index !== undefined ? parseInt(index) : 0;
    const totalBlocks = post.comments.length;
    
    // Validate block index
    if (blockIndex < 0 || blockIndex >= totalBlocks) {
      return res.status(400).json({ 
        error: 'Invalid block index',
        validRange: `0 to ${totalBlocks - 1}`
      });
    }
    
    // Get the PostComment document ID for the specified block
    const commentDocId = post.comments[blockIndex];
    
    // Find the PostComment document
    const postCommentDoc = await PostComment.findById(commentDocId);
    if (!postCommentDoc) {
      return res.status(404).json({ error: 'Comment document not found' });
    }
    
    // Transform comments to include user data
    const transformComments = async (comments) => {
      const transformedComments = [];
      
      for (const comment of comments) {
        try {
          const user = await User.findById(comment.user).select('username profilePicture');
          
          // Handle case where user might not be found
          const userData = user ? {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture
          } : {
            _id: comment.user,
            username: 'Unknown User',
            profilePicture: null
          };
          
          transformedComments.push({
            _id: comment.commentID,
            user: userData,
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        } catch (error) {
          console.error('Error fetching user for comment:', error);
          // Add comment with default user data if there's an error
          transformedComments.push({
            _id: comment.commentID,
            user: {
              _id: comment.user,
              username: 'Unknown User',
              profilePicture: null
            },
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        }
      }
      
      return transformedComments;
    };
    
    // Transform regular comments
    const transformedComments = await transformComments(postCommentDoc.comments);
    
    // Transform popular comments
    const transformedPopularComments = await transformComments(postCommentDoc.popularComments);
    
    // Return the comments
    return res.status(200).json({
      comments: transformedComments,
      popularComments: transformedPopularComments,
      total: post.commentsCount || 0,
      blockIndex,
      totalBlocks,
      hasNextBlock: blockIndex < totalBlocks - 1,
      hasPrevBlock: blockIndex > 0
    });
    
  } catch (error) {
    console.error('Error in getCommentBlockIds:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

/**
 * Get a specific comment block by index
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCommentBlockByIndex = async (req, res) => {
  try {
    const { postId } = req.params;
    const { index } = req.query;
    
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    // Validate index
    if (index === undefined || isNaN(parseInt(index))) {
      return res.status(400).json({ error: 'Valid index is required' });
    }
    
    const blockIndex = parseInt(index);
    
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if post has any comments
    if (!post.comments || post.comments.length === 0) {
      return res.status(200).json({ 
        comments: [],
        popularComments: [],
        total: 0,
        blockIndex: 0,
        totalBlocks: 0
      });
    }
    
    // Check if index is valid
    if (blockIndex < 0 || blockIndex >= post.comments.length) {
      return res.status(400).json({ 
        error: 'Invalid block index',
        validRange: `0 to ${post.comments.length - 1}`
      });
    }
    
    // Get the PostComment document ID for the specified index
    const commentDocId = post.comments[blockIndex];
    
    // Find the PostComment document
    const postCommentDoc = await PostComment.findById(commentDocId);
    if (!postCommentDoc) {
      return res.status(404).json({ error: 'Comment document not found' });
    }
    
    // Transform comments to include user data
    const transformComments = async (comments) => {
      const transformedComments = [];
      
      for (const comment of comments) {
        try {
          const user = await User.findById(comment.user).select('username profilePicture');
          
          // Handle case where user might not be found
          const userData = user ? {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture
          } : {
            _id: comment.user,
            username: 'Unknown User',
            profilePicture: null
          };
          
          transformedComments.push({
            _id: comment.commentID,
            user: userData,
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        } catch (error) {
          console.error('Error fetching user for comment:', error);
          // Add comment with default user data if there's an error
          transformedComments.push({
            _id: comment.commentID,
            user: {
              _id: comment.user,
              username: 'Unknown User',
              profilePicture: null
            },
            text: comment.text,
            likes: comment.likes,
            likesCount: comment.likes ? comment.likes.length : 0,
            isPinned: comment.isPinned,
            replies: comment.replies,
            createdAt: comment.createdAt,
            score: comment.score
          });
        }
      }
      
      return transformedComments;
    };
    
    // Transform regular comments
    const transformedComments = await transformComments(postCommentDoc.comments);
    
    // Transform popular comments
    const transformedPopularComments = await transformComments(postCommentDoc.popularComments);
    
    // Return the comments
    return res.status(200).json({
      comments: transformedComments,
      popularComments: transformedPopularComments,
      total: post.commentsCount || 0,
      blockIndex,
      totalBlocks: post.comments.length,
      hasNextBlock: blockIndex < post.comments.length - 1,
      hasPrevBlock: blockIndex > 0
    });
    
  } catch (error) {
    console.error('Error in getCommentBlockByIndex:', error);
    return res.status(500).json({ error: 'Failed to fetch comment block' });
  }
};

module.exports = {
  getComments,
  createComment,
  pinComment,
  likeUnlikeComment,
  getPostCommentStorage,
  getCommentBlockIds,
  getCommentBlockByIndex
}; 