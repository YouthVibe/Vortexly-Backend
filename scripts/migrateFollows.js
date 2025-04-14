/**
 * Migration script to move follower/following relationships from Follower collection to User model
 * This script should be run once after updating the codebase
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Follower = require('../models/Follower');

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const migrateFollows = async () => {
  try {
    console.log('Starting migration of follow relationships...');
    
    // 1. Get all follow relationships from Follower collection
    const follows = await Follower.find().lean();
    console.log(`Found ${follows.length} follow relationships to migrate`);
    
    if (follows.length === 0) {
      console.log('No follows to migrate. Exiting.');
      return;
    }
    
    // 2. Group follows by follower and following
    const followersMap = {};
    const followingMap = {};
    
    follows.forEach(follow => {
      const followerId = follow.follower.toString();
      const followingId = follow.following.toString();
      
      if (!followersMap[followingId]) {
        followersMap[followingId] = [];
      }
      followersMap[followingId].push(followerId);
      
      if (!followingMap[followerId]) {
        followingMap[followerId] = [];
      }
      followingMap[followerId].push(followingId);
    });
    
    // 3. Update User documents with follower and following arrays
    const userIds = [...new Set([...Object.keys(followersMap), ...Object.keys(followingMap)])];
    console.log(`Updating ${userIds.length} users with follow data`);
    
    let updatedCount = 0;
    for (const userId of userIds) {
      const followers = followersMap[userId] || [];
      const following = followingMap[userId] || [];
      
      await User.findByIdAndUpdate(userId, {
        followersRef: followers,
        followingRef: following,
        followers: followers.length,
        following: following.length
      });
      
      updatedCount++;
      
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} users so far...`);
      }
    }
    
    console.log(`Successfully migrated follow data for ${updatedCount} users`);
    console.log('Migration complete!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
connectDB()
  .then(() => migrateFollows())
  .then(() => {
    console.log('Successfully completed migration');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  }); 