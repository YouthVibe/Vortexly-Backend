/**
 * Script to fix mismatched conversationIds in messages collection.
 * 
 * The issue is that messages are being saved with incorrect conversationIds
 * when they're created. This script finds all messages with wrong conversationIds
 * and updates them to point to the correct conversations.
 */

const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    console.log(`Using database: ${uri.split('/').pop().split('?')[0]}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Disconnect from MongoDB
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
}

// Fix messages with wrong conversationId format or references
async function fixMessages() {
  try {
    // Find all messages
    const messages = await Message.find().lean();
    console.log(`Found ${messages.length} messages to check`);

    let noMatchCount = 0;
    let alreadyCorrectCount = 0;
    let fixedCount = 0;
    let notFixableCount = 0;

    // Process each message
    for (const message of messages) {
      // Skip messages without conversationId
      if (!message.conversationId) {
        console.log(`Message ${message._id} has no conversationId, skipping`);
        continue;
      }

      // Convert conversationId to string if it's an object
      const conversationIdStr = typeof message.conversationId === 'object' && message.conversationId !== null 
        ? message.conversationId.toString() 
        : message.conversationId;

      // Find the conversation with this ID
      let conversation = await Conversation.findById(conversationIdStr).lean();

      // If conversation not found, try to find by participants
      if (!conversation && message.sender) {
        console.log(`Conversation ${conversationIdStr} not found for message ${message._id}, searching by participants...`);
        
        // Find conversations that include this sender
        const conversations = await Conversation.find({
          participants: message.sender,
          type: 'direct' // Assuming it's a direct conversation
        }).lean();

        if (conversations.length === 1) {
          // If only one conversation found, use it
          conversation = conversations[0];
          console.log(`Found a matching conversation ${conversation._id} for message sender ${message.sender}`);
        } else if (conversations.length > 1) {
          // If multiple conversations found, this is ambiguous
          console.log(`Found ${conversations.length} potential matching conversations for message ${message._id}, cannot determine which one is correct`);
          notFixableCount++;
          continue;
        }
      }

      if (!conversation) {
        console.log(`No conversation found for message ${message._id} with conversationId ${conversationIdStr}`);
        noMatchCount++;
        continue;
      }

      // Check if the conversationId is already correct
      if (conversation._id.toString() === conversationIdStr) {
        // Already correct, nothing to do
        alreadyCorrectCount++;
        continue;
      }

      // Fix the conversationId
      console.log(`Fixing message ${message._id}: changing conversationId from ${conversationIdStr} to ${conversation._id}`);
      await Message.findByIdAndUpdate(message._id, { conversationId: conversation._id });
      fixedCount++;
    }

    // Print summary
    console.log("\nSummary:");
    console.log(`Total messages checked: ${messages.length}`);
    console.log(`Messages with no matching conversation: ${noMatchCount}`);
    console.log(`Messages already correct: ${alreadyCorrectCount}`);
    console.log(`Messages fixed: ${fixedCount}`);
    console.log(`Messages not fixable: ${notFixableCount}`);

  } catch (error) {
    console.error('Error fixing messages:', error);
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    await fixMessages();
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await disconnectDB();
  }
}

// Run the script
main(); 