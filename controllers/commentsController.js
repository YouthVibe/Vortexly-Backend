const PostComment = require('../models/PostComment');
const Post = require('../models/Post');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get paginated comments for a post
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 0, limit = 5, sort = 'newest' } = req.query;
    
    // Verify post exists
    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find or create post comment document
    let postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      postComment = new PostComment({
        postID: postId,
        comments: [],
        popularComments: []
      });
      await postComment.save();
    }

    // Calculate skip value based on page and limit
    const skip = page * limit;
    
    // Define sort order
    let sortOption = {};
    if (sort === 'newest') {
      sortOption = { 'comments.createdAt': -1 };
    } else if (sort === 'oldest') {
      sortOption = { 'comments.createdAt': 1 };
    } else if (sort === 'popular') {
      sortOption = { 'comments.score': -1 };
    }

    // Get paginated comments
    const postCommentWithPagination = await PostComment.findOne({ postID: postId })
      .populate({
        path: 'comments.user',
        select: 'username profilePicture'
      })
      .populate({
        path: 'comments.replies.user',
        select: 'username profilePicture'
      })
      .slice('comments', [skip, parseInt(limit)])
      .lean();

    if (!postCommentWithPagination) {
      return res.json({ comments: [], totalComments: 0 });
    }

    // Get total comments count
    const totalComments = postComment.comments.length;

    // Sort the comments based on the sort option
    let comments = postCommentWithPagination.comments || [];
    if (sort === 'newest') {
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'oldest') {
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === 'popular') {
      comments.sort((a, b) => b.score - a.score);
    }

    return res.json({
      comments,
      totalComments,
      currentPage: parseInt(page),
      hasMore: skip + comments.length < totalComments
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get popular comments for a post
exports.getPopularComments = async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Verify post exists
    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find post comment document
    const postComment = await PostComment.findOne({ postID: postId })
      .populate({
        path: 'comments',
        match: { score: { $gt: 0 } },
        options: { sort: { score: -1 }, limit: 2 }
      })
      .populate({
        path: 'comments.user',
        select: 'username profilePicture'
      })
      .populate({
        path: 'comments.replies.user',
        select: 'username profilePicture'
      })
      .lean();

    if (!postComment) {
      return res.json({ popularComments: [] });
    }

    // Get comments with highest scores
    const popularComments = postComment.comments.sort((a, b) => b.score - a.score).slice(0, 2);

    return res.json({ popularComments });
  } catch (error) {
    console.error('Error getting popular comments:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // Verify post exists
    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find or create post comment document
    let postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      postComment = new PostComment({
        postID: postId,
        comments: [],
        popularComments: []
      });
    }

    // Create new comment
    const newComment = {
      commentID: new mongoose.Types.ObjectId(),
      user: userId,
      text: text.trim(),
      likes: [],
      replies: [],
      isPinned: false,
      score: 0,
      createdAt: new Date()
    };

    // Add comment to comments array
    postComment.comments.unshift(newComment);
    await postComment.save();

    // Populate user data for the response
    const populatedComment = await PostComment.findOne(
      { postID: postId, 'comments.commentID': newComment.commentID },
      { 'comments.$': 1 }
    ).populate({
      path: 'comments.user',
      select: 'username profilePicture'
    });

    // Update post comment count
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: populatedComment.comments[0]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Like or unlike a comment
exports.likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Find the post comment document
    const postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      return res.status(404).json({ message: 'Comments not found for this post' });
    }

    // Find the comment
    const commentIndex = postComment.comments.findIndex(
      comment => comment.commentID.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user already liked the comment
    const userLiked = postComment.comments[commentIndex].likes.includes(userId);

    if (userLiked) {
      // Unlike the comment
      postComment.comments[commentIndex].likes.pull(userId);
      postComment.comments[commentIndex].score = Math.max(0, postComment.comments[commentIndex].score - 1);
    } else {
      // Like the comment
      postComment.comments[commentIndex].likes.push(userId);
      postComment.comments[commentIndex].score += 1;
    }

    await postComment.save();

    return res.json({
      message: userLiked ? 'Comment unliked' : 'Comment liked',
      liked: !userLiked,
      commentId,
      likeCount: postComment.comments[commentIndex].likes.length,
      score: postComment.comments[commentIndex].score
    });
  } catch (error) {
    console.error('Error liking/unliking comment:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a reply to a comment
exports.addReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    // Find the post comment document
    const postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      return res.status(404).json({ message: 'Comments not found for this post' });
    }

    // Find the comment
    const commentIndex = postComment.comments.findIndex(
      comment => comment.commentID.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Create new reply
    const newReply = {
      user: userId,
      text: text.trim(),
      likes: [],
      createdAt: new Date()
    };

    // Add reply to comment
    postComment.comments[commentIndex].replies.push(newReply);
    
    // Increase the comment score to reflect the added reply
    postComment.comments[commentIndex].score += 1;
    
    await postComment.save();

    // Populate user data for the response
    const populatedReply = await User.findById(userId).select('username profilePicture');

    newReply.user = populatedReply;

    return res.status(201).json({
      message: 'Reply added successfully',
      reply: newReply,
      commentId
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Pin or unpin a comment
exports.pinComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Verify post exists and user is the owner or admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the user is post owner or admin
    const isAdmin = req.user.role === 'admin';
    const isPostOwner = post.user.toString() === userId;

    if (!isAdmin && !isPostOwner) {
      return res.status(403).json({ message: 'Only post owner can pin comments' });
    }

    // Find the post comment document
    const postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      return res.status(404).json({ message: 'Comments not found for this post' });
    }

    // Find the comment
    const commentIndex = postComment.comments.findIndex(
      comment => comment.commentID.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check current pinned status
    const currentlyPinned = postComment.comments[commentIndex].isPinned;
    
    // Toggle pin status
    postComment.comments[commentIndex].isPinned = !currentlyPinned;

    await postComment.save();

    return res.json({
      message: currentlyPinned ? 'Comment unpinned' : 'Comment pinned',
      isPinned: !currentlyPinned,
      commentId
    });
  } catch (error) {
    console.error('Error pinning/unpinning comment:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Like or unlike a reply
exports.likeReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const userId = req.user.id;

    // Find the post comment document
    const postComment = await PostComment.findOne({ postID: postId });
    if (!postComment) {
      return res.status(404).json({ message: 'Comments not found for this post' });
    }

    // Find the comment
    const commentIndex = postComment.comments.findIndex(
      comment => comment.commentID.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Find the reply
    const replyIndex = postComment.comments[commentIndex].replies.findIndex(
      reply => reply._id.toString() === replyId
    );

    if (replyIndex === -1) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Check if user already liked the reply
    const userLiked = postComment.comments[commentIndex].replies[replyIndex].likes.includes(userId);

    if (userLiked) {
      // Unlike the reply
      postComment.comments[commentIndex].replies[replyIndex].likes.pull(userId);
    } else {
      // Like the reply
      postComment.comments[commentIndex].replies[replyIndex].likes.push(userId);
    }

    await postComment.save();

    return res.json({
      message: userLiked ? 'Reply unliked' : 'Reply liked',
      liked: !userLiked,
      commentId,
      replyId,
      likeCount: postComment.comments[commentIndex].replies[replyIndex].likes.length
    });
  } catch (error) {
    console.error('Error liking/unliking reply:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 