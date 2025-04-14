/**
 * Fix-User-Post-Count Script
 * This script updates the post count for a specific user, synchronizing it with the actual
 * count of posts in the database.
 * 
 * Usage: node scripts/fix-user-post-count.js <userId>
 * Example: node scripts/fix-user-post-count.js 61234567890abcdef1234567
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

const fixUserPostCount = async () => {
  try {
    // Get the user ID from command line arguments
    const userId = process.argv[2];
    if (!userId) {
      console.error('Please provide a user ID as an argument');
      console.error('Example: node scripts/fix-user-post-count.js 61234567890abcdef1234567');
      process.exit(1);
    }

    // Connect to MongoDB
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      console.error('No MongoDB connection string found in .env file (MONGODB_URI)');
      process.exit(1);
    }

    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.error(`No user found with ID: ${userId}`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.name} (${user._id})`);
    
    // Count actual posts for this user
    const actualPostCount = await Post.countDocuments({ user: user._id });
    const storedPostCount = user.posts || 0;
    
    console.log(`Current post count: ${storedPostCount}`);
    console.log(`Actual post count: ${actualPostCount}`);
    
    // If the counts are different, update the user's post count
    if (actualPostCount !== storedPostCount) {
      console.log(`Updating post count: ${storedPostCount} → ${actualPostCount}`);
      
      await User.findByIdAndUpdate(user._id, { posts: actualPostCount });
      console.log('Post count updated successfully!');
    } else {
      console.log('Post count is already correct, no update needed.');
    }
    
  } catch (error) {
    console.error('Error fixing post count:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the script
fixUserPostCount(); 