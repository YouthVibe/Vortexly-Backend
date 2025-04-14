const mongoose = require('mongoose');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');
const Comment = require('../models/Comment');
const User = require('../models/User');

/**
 * Calculate the score for a comment based on likes and replies
 * @param {Object} comment - The comment object
 * @returns {number} The calculated score
 */
const calculateCommentScore = (comment) => {
  const likesCount = comment.likes ? comment.likes.length : 0;
  const repliesCount = comment.replies ? comment.replies.length : 0;
  return likesCount + (repliesCount / 100);
};

/**
 * Update popular comments for a post
 * @param {string} postId - The ID of the post
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Promise<void>}
 */
const updatePopularComments = async (postId, session) => {
  try {
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // If post has no comments, nothing to update
    if (!post.comments || post.comments.length === 0) {
      return;
    }

    // Get all comment blocks
    const commentBlocks = await PostComment.find({
      _id: { $in: post.comments }
    });

    // Extract all comments from all blocks
    let allComments = [];
    
    commentBlocks.forEach(block => {
      allComments = [...allComments, ...block.comments];
    });

    // Calculate score for each comment
    allComments.forEach(comment => {
      comment.score = calculateCommentScore(comment);
    });

    // Sort comments by score (descending)
    allComments.sort((a, b) => b.score - a.score);

    // Get top 5 comments (or fewer if there are less than 5)
    const topComments = allComments.slice(0, 5);

    // Update each comment block with the new popular comments
    for (const block of commentBlocks) {
      // Clear existing popular comments
      block.popularComments = [];
      
      // Add top comments to this block's popular comments
      block.popularComments = topComments.map(comment => ({
        commentID: comment.commentID,
        user: comment.user,
        text: comment.text,
        likes: comment.likes,
        isPinned: comment.isPinned,
        score: comment.score,
        replies: comment.replies,
        createdAt: comment.createdAt
      }));
      
      // Save the updated block
      if (session) {
        await block.save({ session });
      } else {
        await block.save();
      }
    }
  } catch (error) {
    console.error('Error in updatePopularComments:', error);
    throw error;
  }
};

/**
 * Get comments for a post with sorting options
 * @param {string} postId - The ID of the post
 * @param {number} limit - Number of comments to return per category
 * @param {number} skip - Number of comments to skip (for pagination)
 * @param {string} sortBy - Sorting option (newest, oldest, popular)
 * @returns {Promise<Object>} Object containing pinned, popular, and regular comments
 */
const getPostComments = async (postId, limit = 10, skip = 0, sortBy = 'newest') => {
  try {
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new Error('Invalid post ID');
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // If post has no comments, return empty arrays
    if (!post.comments || post.comments.length === 0) {
      return {
        pinned: [],
        popular: [],
        regular: [],
        total: 0
      };
    }

    // Get all comment blocks
    const commentBlocks = await PostComment.find({
      _id: { $in: post.comments }
    });

    // Extract all comments from all blocks
    let allComments = [];
    let allPopularComments = [];
    
    commentBlocks.forEach(block => {
      allComments = [...allComments, ...block.comments];
      allPopularComments = [...allPopularComments, ...block.popularComments];
    });

    // Determine sort order and field based on sortBy parameter
    let sortOrder = -1; // Default to descending
    let sortField = 'createdAt';

    switch (sortBy) {
      case 'oldest':
        sortOrder = 1;
        break;
      case 'popular':
        sortField = 'likes';
        break;
      case 'newest':
      default:
        sortOrder = -1;
        sortField = 'createdAt';
    }

    // Sort comments based on the specified criteria
    const sortComments = (comments) => {
      return comments.sort((a, b) => {
        if (sortField === 'likes') {
          return sortOrder * (b.likes.length - a.likes.length);
        } else {
          return sortOrder * (new Date(b[sortField]) - new Date(a[sortField]));
        }
      });
    };

    // Sort all comments
    allComments = sortComments(allComments);
    allPopularComments = sortComments(allPopularComments);

    // Filter pinned comments
    const pinnedComments = allComments.filter(comment => comment.isPinned);
    
    // Filter regular comments (non-pinned)
    const regularComments = allComments.filter(comment => !comment.isPinned);

    // Apply pagination
    const paginatedPinned = pinnedComments.slice(skip, skip + limit);
    const paginatedPopular = allPopularComments.slice(skip, skip + limit);
    const paginatedRegular = regularComments.slice(skip, skip + limit);

    return {
      pinned: paginatedPinned,
      popular: paginatedPopular,
      regular: paginatedRegular,
      total: allComments.length
    };
  } catch (error) {
    console.error('Error in getPostComments:', error);
    throw error;
  }
};

/**
 * Add a new comment to a post
 * @param {string} postId - The ID of the post
 * @param {Object} commentData - The comment data
 * @returns {Promise<Object>} The created comment
 */
const addComment = async (postId, commentData) => {
  try {
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new Error('Invalid post ID');
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Create a new comment object
    const newComment = {
      commentID: new mongoose.Types.ObjectId(),
      user: commentData.user,
      text: commentData.text,
      likes: [],
      isPinned: false,
      score: 0,
      replies: [],
      createdAt: new Date()
    };

    // Check if post has any comment blocks
    if (!post.comments || post.comments.length === 0) {
      // Create a new PostComment document
      const postCommentDoc = new PostComment({
        postID: postId,
        comments: [newComment],
        popularComments: []
      });
      
      // Save the new PostComment document
      await postCommentDoc.save();
      
      // Update the post with the new comment block ID
      post.comments = [postCommentDoc._id];
      post.commentsCount = 1;
      await post.save();
      
      // Return the new comment with user data
      return {
        ...newComment,
        _id: newComment.commentID
      };
    }

    // Get the last comment block
    const lastBlockIndex = post.comments.length - 1;
    const lastBlockId = post.comments[lastBlockIndex];
    
    // Find the last comment block
    const lastBlock = await PostComment.findById(lastBlockId);
    if (!lastBlock) {
      throw new Error('Comment block not found');
    }
    
    // Check if the last block has less than 5 comments
    if (lastBlock.comments.length < 5) {
      // Add the comment to the existing block
      lastBlock.comments.push(newComment);
      await lastBlock.save();
      
      // Update post comment count
      post.commentsCount += 1;
      await post.save();
      
      // Return the new comment with user data
      return {
        ...newComment,
        _id: newComment.commentID
      };
    } else {
      // Create a new PostComment document
      const postCommentDoc = new PostComment({
        postID: postId,
        comments: [newComment],
        popularComments: []
      });
      
      // Save the new PostComment document
      await postCommentDoc.save();
      
      // Update the post with the new comment block ID
      post.comments.push(postCommentDoc._id);
      post.commentsCount += 1;
      await post.save();
      
      // Return the new comment with user data
      return {
        ...newComment,
        _id: newComment.commentID
      };
    }
  } catch (error) {
    console.error('Error in addComment:', error);
    throw error;
  }
};

/**
 * Toggle pin status of a comment
 * @param {string} postId - The ID of the post
 * @param {string} commentId - The ID of the comment
 * @param {string} userId - The ID of the user who is pinning/unpinning
 * @returns {Promise<Object>} The updated comment
 */
const togglePinComment = async (postId, commentId, userId) => {
  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid ID format');
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if user is the post owner
    if (post.user.toString() !== userId) {
      throw new Error('Only post owner can pin/unpin comments');
    }

    // If post has no comments, return error
    if (!post.comments || post.comments.length === 0) {
      throw new Error('No comments found for this post');
    }

    // Get all comment blocks
    const commentBlocks = await PostComment.find({
      _id: { $in: post.comments }
    });

    // Find the comment in any of the blocks
    let commentFound = false;
    let commentBlock = null;
    let commentIndex = -1;

    for (const block of commentBlocks) {
      const index = block.comments.findIndex(c => c.commentID.toString() === commentId);
      if (index !== -1) {
        commentFound = true;
        commentBlock = block;
        commentIndex = index;
        break;
      }
    }

    if (!commentFound) {
      throw new Error('Comment not found');
    }

    // Toggle pin status
    commentBlock.comments[commentIndex].isPinned = !commentBlock.comments[commentIndex].isPinned;

    // Save the updated block
    await commentBlock.save();

    // Get user data for the comment
    let userData;
    try {
      const user = await User.findById(commentBlock.comments[commentIndex].user).select('username profilePicture');
      
      // Handle case where user might not be found
      userData = user ? {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      } : {
        _id: commentBlock.comments[commentIndex].user,
        username: 'Unknown User',
        profilePicture: null
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      userData = {
        _id: commentBlock.comments[commentIndex].user,
        username: 'Unknown User',
        profilePicture: null
      };
    }

    // Return the updated comment with user data
    return {
      ...commentBlock.comments[commentIndex],
      _id: commentBlock.comments[commentIndex].commentID,
      user: userData
    };
  } catch (error) {
    console.error('Error in togglePinComment:', error);
    throw error;
  }
};

/**
 * Like or unlike a comment
 * @param {string} postId - The ID of the post
 * @param {string} commentId - The ID of the comment
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} The updated comment
 */
const likeComment = async (postId, commentId, userId) => {
  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid ID format');
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // If post has no comments, return error
    if (!post.comments || post.comments.length === 0) {
      throw new Error('No comments found for this post');
    }

    // Get all comment blocks
    const commentBlocks = await PostComment.find({
      _id: { $in: post.comments }
    });

    // Find the comment in any of the blocks
    let commentFound = false;
    let commentBlock = null;
    let commentIndex = -1;

    for (const block of commentBlocks) {
      const index = block.comments.findIndex(c => c.commentID.toString() === commentId);
      if (index !== -1) {
        commentFound = true;
        commentBlock = block;
        commentIndex = index;
        break;
      }
    }

    if (!commentFound) {
      throw new Error('Comment not found');
    }

    // Check if user has already liked the comment
    const likeIndex = commentBlock.comments[commentIndex].likes.indexOf(userId);
    const isLiking = likeIndex === -1;

    if (isLiking) {
      // Add like
      commentBlock.comments[commentIndex].likes.push(userId);
    } else {
      // Remove like
      commentBlock.comments[commentIndex].likes.splice(likeIndex, 1);
    }

    // Update comment score
    commentBlock.comments[commentIndex].score = calculateCommentScore(commentBlock.comments[commentIndex]);

    // Save the updated block
    await commentBlock.save();

    // Update popular comments if needed
    await updatePopularComments(postId);

    // Get user data for the comment
    let userData;
    try {
      const user = await User.findById(commentBlock.comments[commentIndex].user).select('username profilePicture');
      
      // Handle case where user might not be found
      userData = user ? {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      } : {
        _id: commentBlock.comments[commentIndex].user,
        username: 'Unknown User',
        profilePicture: null
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      userData = {
        _id: commentBlock.comments[commentIndex].user,
        username: 'Unknown User',
        profilePicture: null
      };
    }

    // Return the updated comment with user data
    return {
      ...commentBlock.comments[commentIndex],
      _id: commentBlock.comments[commentIndex].commentID,
      user: userData
    };
  } catch (error) {
    console.error('Error in likeComment:', error);
    throw error;
  }
};

module.exports = {
  getPostComments,
  addComment,
  togglePinComment,
  likeComment,
  updatePopularComments
}; 