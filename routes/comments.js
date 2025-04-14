const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/posts/:postId/comments
 * @desc    Get comments for a post with pagination
 * @access  Public
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { blockIndex = 0, sortBy = 'newest', limit = 5 } = req.query;
    
    // Convert blockIndex to a number and validate (we only have 2 blocks in our structure)
    let index = parseInt(blockIndex, 10);
    index = index > 0 ? 1 : 0; // Ensure index is either 0 or 1
    
    // Find the post to verify it exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Find the appropriate comment document based on blockIndex
    const commentDoc = await PostComment.findOne({ 
      postID: mongoose.Types.ObjectId(postId),
      // In your schema, you would need to determine which document to fetch based on blockIndex
      // This is a simplified approach, you may need to adjust based on how you distinguish between blocks
    }).skip(index).limit(1);
    
    if (!commentDoc) {
      return res.json({ 
        comments: [],
        totalComments: post.commentsCount || 0,
        blockIndex: index
      });
    }
    
    let comments = commentDoc.comments || [];
    
    // Apply sorting if needed
    if (sortBy === 'newest') {
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'popular') {
      comments.sort((a, b) => b.score - a.score);
    }
    
    return res.json({
      comments: comments,
      totalComments: post.commentsCount || 0,
      blockIndex: index
    });
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/posts/:postId/comments/popular
 * @desc    Get popular comments for a post
 * @access  Public
 */
router.get('/posts/:postId/comments/popular', async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Find all comment docs for this post
    const commentDocs = await PostComment.find({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDocs || commentDocs.length === 0) {
      return res.json({ popularComments: [] });
    }
    
    // Combine popular comments from all docs
    const popularComments = [];
    commentDocs.forEach(doc => {
      if (doc.popularComments && doc.popularComments.length > 0) {
        popularComments.push(...doc.popularComments);
      }
    });
    
    // Sort by score (descending)
    popularComments.sort((a, b) => b.score - a.score);
    
    return res.json({ popularComments });
    
  } catch (error) {
    console.error('Error fetching popular comments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/posts/:postId/comments
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post('/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Create new comment object
    const newComment = {
      commentID: new mongoose.Types.ObjectId(),
      user: mongoose.Types.ObjectId(userId),
      text,
      likes: [],
      isPinned: false,
      score: 0,
      replies: [],
      createdAt: new Date()
    };
    
    // Find the appropriate comment document or create a new one
    // In this case, we're assuming if it has < 5 comments, we add to first doc
    let commentDoc = await PostComment.findOne({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDoc) {
      // Create first comment doc
      commentDoc = new PostComment({
        postID: mongoose.Types.ObjectId(postId),
        comments: [newComment],
        popularComments: []
      });
    } else {
      // Check if we should add to first or second doc
      if (commentDoc.comments.length < 5) {
        commentDoc.comments.push(newComment);
      } else {
        // Check if second doc exists
        let secondDoc = await PostComment.find({ 
          postID: mongoose.Types.ObjectId(postId) 
        }).skip(1).limit(1);
        
        if (secondDoc && secondDoc.length > 0) {
          // Add to second doc
          secondDoc = secondDoc[0];
          secondDoc.comments.push(newComment);
          await secondDoc.save();
        } else {
          // Create second doc
          const newDoc = new PostComment({
            postID: mongoose.Types.ObjectId(postId),
            comments: [newComment],
            popularComments: []
          });
          await newDoc.save();
        }
      }
    }
    
    await commentDoc.save();
    
    // Update post comment count
    post.commentsCount = (post.commentsCount || 0) + 1;
    
    // Add comment ID to post's comments array
    if (!post.comments) {
      post.comments = [];
    }
    post.comments.push(newComment.commentID);
    
    await post.save();
    
    return res.status(201).json(newComment);
    
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/posts/:postId/comments/:commentId/like
 * @desc    Like or unlike a comment
 * @access  Private
 */
router.post('/posts/:postId/comments/:commentId/like', auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;
    
    // Find all comment docs for this post
    const commentDocs = await PostComment.find({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDocs || commentDocs.length === 0) {
      return res.status(404).json({ message: 'Comments not found' });
    }
    
    // Find the comment in any of the docs
    let foundDoc = null;
    let comment = null;
    
    for (const doc of commentDocs) {
      comment = doc.comments.find(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (comment) {
        foundDoc = doc;
        break;
      }
      
      // Also check in popularComments
      comment = doc.popularComments.find(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (comment) {
        foundDoc = doc;
        break;
      }
    }
    
    if (!comment || !foundDoc) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Toggle like
    const userIdObj = mongoose.Types.ObjectId(userId);
    const likeIndex = comment.likes.findIndex(id => id.toString() === userId);
    
    if (likeIndex === -1) {
      // Add like
      comment.likes.push(userIdObj);
      comment.score += 1;
    } else {
      // Remove like
      comment.likes.splice(likeIndex, 1);
      comment.score -= 1;
    }
    
    await foundDoc.save();
    
    return res.json(comment);
    
  } catch (error) {
    console.error('Error liking comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/posts/:postId/comments/:commentId/reply
 * @desc    Add a reply to a comment
 * @access  Private
 */
router.post('/posts/:postId/comments/:commentId/reply', auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    // Find all comment docs for this post
    const commentDocs = await PostComment.find({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDocs || commentDocs.length === 0) {
      return res.status(404).json({ message: 'Comments not found' });
    }
    
    // Find the comment in any of the docs
    let foundDoc = null;
    let comment = null;
    let commentIndex = -1;
    
    for (const doc of commentDocs) {
      commentIndex = doc.comments.findIndex(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (commentIndex !== -1) {
        comment = doc.comments[commentIndex];
        foundDoc = doc;
        break;
      }
      
      // Also check in popularComments
      commentIndex = doc.popularComments.findIndex(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (commentIndex !== -1) {
        comment = doc.popularComments[commentIndex];
        foundDoc = doc;
        break;
      }
    }
    
    if (!comment || !foundDoc) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Create new reply
    const newReply = {
      _id: new mongoose.Types.ObjectId(),
      user: mongoose.Types.ObjectId(userId),
      text,
      likes: [],
      createdAt: new Date()
    };
    
    // Add reply to comment
    if (!comment.replies) {
      comment.replies = [];
    }
    
    comment.replies.push(newReply);
    comment.score += 1; // Increment score for receiving a reply
    
    await foundDoc.save();
    
    return res.status(201).json(newReply);
    
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/posts/:postId/comments/:commentId/pin
 * @desc    Pin or unpin a comment
 * @access  Private (admin or post owner only)
 */
router.post('/posts/:postId/comments/:commentId/pin', auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;
    
    // Find the post to verify ownership
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user is post owner
    if (post.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to pin comments on this post' });
    }
    
    // Find all comment docs for this post
    const commentDocs = await PostComment.find({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDocs || commentDocs.length === 0) {
      return res.status(404).json({ message: 'Comments not found' });
    }
    
    // Find the comment in any of the docs
    let foundDoc = null;
    let comment = null;
    
    for (const doc of commentDocs) {
      comment = doc.comments.find(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (comment) {
        foundDoc = doc;
        break;
      }
    }
    
    if (!comment || !foundDoc) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Toggle pin status
    comment.isPinned = !comment.isPinned;
    
    // If pinned, add to popularComments if not already there
    if (comment.isPinned) {
      // Remove from popularComments in all docs first (in case it was added before)
      for (const doc of commentDocs) {
        doc.popularComments = doc.popularComments.filter(c => 
          c.commentID.toString() !== comment.commentID.toString()
        );
        await doc.save();
      }
      
      // Add to first doc's popularComments
      const firstDoc = commentDocs[0];
      if (!firstDoc.popularComments.some(c => 
        c.commentID.toString() === comment.commentID.toString()
      )) {
        firstDoc.popularComments.push(comment);
        await firstDoc.save();
      }
    } else {
      // Remove from popularComments if unpinned
      foundDoc.popularComments = foundDoc.popularComments.filter(c => 
        c.commentID.toString() !== comment.commentID.toString()
      );
    }
    
    await foundDoc.save();
    
    return res.json(comment);
    
  } catch (error) {
    console.error('Error pinning comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/posts/:postId/comments/:commentId/replies/:replyId/like
 * @desc    Like or unlike a reply
 * @access  Private
 */
router.post('/posts/:postId/comments/:commentId/replies/:replyId/like', auth, async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const userId = req.user.id;
    
    // Find all comment docs for this post
    const commentDocs = await PostComment.find({ postID: mongoose.Types.ObjectId(postId) });
    
    if (!commentDocs || commentDocs.length === 0) {
      return res.status(404).json({ message: 'Comments not found' });
    }
    
    // Find the comment in any of the docs
    let foundDoc = null;
    let comment = null;
    
    for (const doc of commentDocs) {
      comment = doc.comments.find(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (comment) {
        foundDoc = doc;
        break;
      }
      
      // Also check in popularComments
      comment = doc.popularComments.find(c => 
        c.commentID.toString() === commentId || 
        c._id.toString() === commentId
      );
      
      if (comment) {
        foundDoc = doc;
        break;
      }
    }
    
    if (!comment || !foundDoc) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Find the reply
    if (!comment.replies || comment.replies.length === 0) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    
    const reply = comment.replies.find(r => 
      r._id.toString() === replyId
    );
    
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    
    // Toggle like
    const userIdObj = mongoose.Types.ObjectId(userId);
    const likeIndex = reply.likes.findIndex(id => id.toString() === userId);
    
    if (likeIndex === -1) {
      // Add like
      reply.likes.push(userIdObj);
    } else {
      // Remove like
      reply.likes.splice(likeIndex, 1);
    }
    
    await foundDoc.save();
    
    return res.json(reply);
    
  } catch (error) {
    console.error('Error liking reply:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 