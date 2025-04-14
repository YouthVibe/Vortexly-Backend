const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  imageId: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  imageIds: [{
    type: String
  }],
  moreThanOneImage: {
    type: Boolean,
    default: false
  },
  caption: {
    type: String,
    default: ''
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PostComment'
  }],
  commentsCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  isVideo: {
    type: Boolean,
    default: false
  },
  videoUrl: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

const Post = mongoose.model('Post', postSchema);

module.exports = Post; 