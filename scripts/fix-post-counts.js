/**
 * Fix-Post-Counts Script
 * This script updates the post count field for all users, synchronizing it with the actual
 * count of posts in the database. It addresses issues where the User.posts counter gets out of sync
 * with the actual number of posts a user has created.
 * 
 * To run: node scripts/fix-post-counts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

const fixPostCounts = async () => {
  try {
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
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    let fixedCount = 0;
    let unchangedCount = 0;
    
    // Process each user
    for (const user of users) {
      // Count actual posts for this user
      const actualPostCount = await Post.countDocuments({ user: user._id });
      const storedPostCount = user.posts || 0;
      
      // If the counts are different, update the user's post count
      if (actualPostCount !== storedPostCount) {
        console.log(`Fixing post count for user ${user._id} (${user.name}): ${storedPostCount} → ${actualPostCount}`);
        
        await User.findByIdAndUpdate(user._id, { posts: actualPostCount });
        fixedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    console.log('\n--- SUMMARY ---');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Post counts fixed: ${fixedCount}`);
    console.log(`Users already in sync: ${unchangedCount}`);
    
    console.log('\nPost count sync completed successfully!');
  } catch (error) {
    console.error('Error fixing post counts:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the script
fixPostCounts(); 