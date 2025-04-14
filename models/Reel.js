const mongoose = require('mongoose');

const ReelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 2200
  },
  tags: [String],
  isPrivate: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  allowDuets: {
    type: Boolean,
    default: true
  },
  audioTrack: {
    title: String,
    artist: String,
    audioUrl: String,
    duration: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      required: true
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      text: {
        type: String,
        required: true
      },
      likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
ReelSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
ReelSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Index for better performance
ReelSchema.index({ user: 1, createdAt: -1 });
ReelSchema.index({ tags: 1 });
ReelSchema.index({ isPrivate: 1 });

const Reel = mongoose.model('Reel', ReelSchema);

module.exports = Reel; 