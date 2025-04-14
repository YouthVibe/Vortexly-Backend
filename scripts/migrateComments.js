/**
 * Script to migrate existing comments from Post documents to the new PostComment collection
 * 
 * Usage:
 * node migrateComments.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected for migration'))
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

const migrateComments = async () => {
  try {
    // Get count of posts with comments
    const totalPostsWithComments = await Post.countDocuments({
      'comments.0': { $exists: true }
    });
    
    console.log(`Found ${totalPostsWithComments} posts with comments`);
    
    // Process posts in batches to avoid memory issues
    const batchSize = 100;
    let processedCount = 0;
    let totalCommentsProcessed = 0;
    let totalCommentDocumentsCreated = 0;
    
    // Get posts with comments
    const cursor = Post.find({
      'comments.0': { $exists: true }
    }).cursor();
    
    for (let post = await cursor.next(); post != null; post = await cursor.next()) {
      // Skip if no comments
      if (!post.comments || post.comments.length === 0) {
        continue;
      }
      
      const postId = post._id;
      const oldComments = post.comments || [];
      
      console.log(`Processing post ${postId} with ${oldComments.length} comments`);
      totalCommentsProcessed += oldComments.length;
      
      // Create PostComment documents (max 10 comments per document)
      const postCommentDocs = [];
      
      // Group comments in chunks of 10
      for (let i = 0; i < oldComments.length; i += 10) {
        const commentChunk = oldComments.slice(i, i + 10);
        
        // Transform comments to new format
        const transformedComments = commentChunk.map(comment => ({
          commentID: new mongoose.Types.ObjectId(),
          user: comment.user,
          text: comment.text,
          likes: comment.likes || [],
          isPinned: false, // No pinned status in old format
          replies: comment.replies || [],
          createdAt: comment.createdAt
        }));
        
        // Create a new PostComment document
        const postCommentDoc = new PostComment({
          postID: postId,
          comments: transformedComments,
          createdAt: post.createdAt
        });
        
        await postCommentDoc.save();
        postCommentDocs.push(postCommentDoc._id);
        totalCommentDocumentsCreated++;
      }
      
      // Update the post to reference the new comment documents
      post.comments = postCommentDocs;
      post.commentsCount = oldComments.length;
      await post.save();
      
      processedCount++;
      
      if (processedCount % batchSize === 0) {
        console.log(`Processed ${processedCount}/${totalPostsWithComments} posts`);
      }
    }
    
    console.log('==================== MIGRATION COMPLETE ====================');
    console.log(`Total posts processed: ${processedCount}`);
    console.log(`Total comments processed: ${totalCommentsProcessed}`);
    console.log(`Total PostComment documents created: ${totalCommentDocumentsCreated}`);
    
  } catch (error) {
    console.error('Error in migration:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the migration
migrateComments(); 