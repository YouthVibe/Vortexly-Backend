const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StorySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  media: {
    type: String,
    required: true
  },
  mediaId: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  caption: {
    type: String,
    default: ''
  },
  views: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically delete after 24 hours (in seconds)
  }
});

// Create indexes for performance
StorySchema.index({ user: 1, createdAt: -1 });
StorySchema.index({ createdAt: 1 }); // For TTL expiration

module.exports = mongoose.model('Story', StorySchema); 