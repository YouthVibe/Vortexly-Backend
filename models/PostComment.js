const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Comment reply schema
const ReplySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Comment schema
const CommentSchema = new Schema({
  commentID: {
    type: Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [ReplySchema],
  isPinned: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Post comment document schema
const PostCommentSchema = new Schema({
  postID: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  comments: [CommentSchema],
  popularComments: [CommentSchema]
}, { timestamps: true });

// Create indexes for faster queries
PostCommentSchema.index({ postID: 1 });

module.exports = mongoose.model('PostComment', PostCommentSchema); 