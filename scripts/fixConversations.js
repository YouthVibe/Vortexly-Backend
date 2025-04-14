/**
 * Fix Conversations Script
 * 
 * This script cleans up the database by:
 * 1. Identifying messages with invalid conversation IDs
 * 2. Finding the correct conversation for these messages
 * 3. Updating the messages to point to the correct conversation
 * 4. Logging a report of fixed messages
 * 
 * Run with: node scripts/fixConversations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Connect to MongoDB
const connectDB = require('../config/db');

async function fixConversations() {
  console.log('Starting conversation fix script...');
  
  try {
    await connectDB();
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);
    
    // Find all conversations
    const conversations = await Conversation.find({}).lean();
    console.log(`Found ${conversations.length} conversations`);
    
    // Find all messages
    const messages = await Message.find({}).lean();
    console.log(`Found ${messages.length} messages`);
    
    // Find messages with invalid conversation IDs
    const messagesByConversation = {};
    const invalidMessages = [];
    
    for (const message of messages) {
      const conversationId = message.conversation ? message.conversation.toString() : null;
      
      if (!conversationId) {
        invalidMessages.push({
          messageId: message._id,
          reason: 'Missing conversation ID'
        });
        continue;
      }
      
      if (!messagesByConversation[conversationId]) {
        messagesByConversation[conversationId] = [];
      }
      
      messagesByConversation[conversationId].push(message);
    }
    
    // Check which conversation IDs don't exist
    const validConversationIds = new Set(conversations.map(c => c._id.toString()));
    const missingConversationIds = Object.keys(messagesByConversation).filter(
      id => !validConversationIds.has(id)
    );
    
    console.log(`Found ${missingConversationIds.length} invalid conversation IDs in messages`);
    
    // For each missing conversation, find the appropriate existing conversation
    const fixedMessages = [];
    
    for (const invalidConvId of missingConversationIds) {
      const messagesInConv = messagesByConversation[invalidConvId];
      console.log(`Processing ${messagesInConv.length} messages with invalid conversation ID: ${invalidConvId}`);
      
      // Get the participants from these messages
      const participantIds = new Set();
      
      for (const message of messagesInConv) {
        if (message.sender) {
          participantIds.add(message.sender.toString());
        }
      }
      
      console.log(`Found ${participantIds.size} participants in these messages`);
      
      if (participantIds.size < 2) {
        // We need to find other participants
        console.log('Not enough participants, looking for connections');
        
        // Take the first sender
        const firstSender = messagesInConv[0].sender;
        
        if (!firstSender) {
          console.log('No sender found for message, skipping');
          continue;
        }
        
        // Look for conversations with this sender
        const userConversations = conversations.filter(c => 
          c.participants.some(p => p.toString() === firstSender.toString())
        );
        
        console.log(`Found ${userConversations.length} conversations for user ${firstSender}`);
        
        if (userConversations.length === 0) {
          console.log('No existing conversations found, creating a new one');
          continue;
        }
        
        // Use the first conversation
        const targetConversation = userConversations[0];
        
        // Update all messages in this invalid conversation
        for (const message of messagesInConv) {
          await Message.updateOne(
            { _id: message._id },
            { $set: { conversation: targetConversation._id } }
          );
          
          fixedMessages.push({
            messageId: message._id,
            oldConversation: invalidConvId,
            newConversation: targetConversation._id.toString()
          });
        }
        
        console.log(`Fixed ${messagesInConv.length} messages to use conversation ${targetConversation._id}`);
      } else {
        // We have at least 2 participants, find a matching conversation
        const participantArr = Array.from(participantIds);
        
        // Look for a conversation with these participants
        const matchingConversation = conversations.find(c => {
          const convParticipants = c.participants.map(p => p.toString());
          return participantArr.every(p => convParticipants.includes(p));
        });
        
        if (matchingConversation) {
          console.log(`Found matching conversation ${matchingConversation._id}`);
          
          // Update all messages in this invalid conversation
          for (const message of messagesInConv) {
            await Message.updateOne(
              { _id: message._id },
              { $set: { conversation: matchingConversation._id } }
            );
            
            fixedMessages.push({
              messageId: message._id,
              oldConversation: invalidConvId,
              newConversation: matchingConversation._id.toString()
            });
          }
          
          console.log(`Fixed ${messagesInConv.length} messages to use conversation ${matchingConversation._id}`);
        } else {
          console.log('No matching conversation found, creating a new one');
          
          // Create a new conversation with these participants
          const newConversation = await Conversation.create({
            participants: Array.from(participantIds),
            isGroupChat: false,
            unreadCount: {}
          });
          
          console.log(`Created new conversation ${newConversation._id}`);
          
          // Update all messages in this invalid conversation
          for (const message of messagesInConv) {
            await Message.updateOne(
              { _id: message._id },
              { $set: { conversation: newConversation._id } }
            );
            
            fixedMessages.push({
              messageId: message._id,
              oldConversation: invalidConvId,
              newConversation: newConversation._id.toString()
            });
          }
          
          console.log(`Fixed ${messagesInConv.length} messages to use conversation ${newConversation._id}`);
          
          // Update last message
          if (messagesInConv.length > 0) {
            // Sort by date
            const sortedMessages = messagesInConv.sort((a, b) => {
              return new Date(b.createdAt) - new Date(a.createdAt);
            });
            
            const lastMessage = sortedMessages[0];
            
            await Conversation.updateOne(
              { _id: newConversation._id },
              { $set: { lastMessage: lastMessage._id } }
            );
          }
        }
      }
    }
    
    console.log('\n---- Fix Report ----');
    console.log(`Fixed ${fixedMessages.length} messages with invalid conversation IDs`);
    
    // Group by old conversation
    const fixesByOldConv = {};
    for (const fix of fixedMessages) {
      if (!fixesByOldConv[fix.oldConversation]) {
        fixesByOldConv[fix.oldConversation] = [];
      }
      fixesByOldConv[fix.oldConversation].push(fix);
    }
    
    for (const [oldConv, fixes] of Object.entries(fixesByOldConv)) {
      console.log(`- ${oldConv} -> ${fixes[0].newConversation} (${fixes.length} messages)`);
    }
    
  } catch (error) {
    console.error('Error fixing conversations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

fixConversations(); 