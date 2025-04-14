const mongoose = require('mongoose');

const followerSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can only follow another user once
followerSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follower = mongoose.model('Follower', followerSchema);

module.exports = Follower; 