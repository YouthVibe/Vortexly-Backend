const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { formatUserStatus } = require('./formatters');

// Map to store socket connections by user ID
const connectedUsers = new Map();

// Socket manager utils
let io;

// Function to set up socket events for a specific connection
const setupSocketEvents = (io, socket, userId) => {
  console.log(`Setting up socket events for user ${userId}`);
  
  // Keep track of active connections per user
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socket.id);
  
  // Update user's online status in conversations
  updateUserOnlineStatus(userId, true);
  
  // Join user-specific room
  socket.join(`user:${userId}`);
  
  // Set up heartbeat ping/pong to keep connection alive
  let heartbeatInterval = setInterval(() => {
    socket.emit('ping');
  }, 20000); // Send ping every 20 seconds
  
  socket.on('pong', () => {
    // Got pong response from client
    console.log(`Received pong from user ${userId}`);
  });
  
  // Clean up heartbeat on disconnect
  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected (socket: ${socket.id})`);
    
    // Clean up heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Remove this socket from the user's connections
    if (connectedUsers.has(userId)) {
      const userSockets = connectedUsers.get(userId);
      userSockets.delete(socket.id);
      
      // If this was the user's last connection, update their status to offline
      if (userSockets.size === 0) {
        updateUserOnlineStatus(userId, false);
        connectedUsers.delete(userId);
      }
    }
  });
  
  // Handle typing events
  socket.on('typing_start', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;
      
      // Update typing status in conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (conversation) {
        await conversation.updateTypingStatus(userId, true);
        
        // Notify other participants
        const otherParticipants = conversation.participants
          .filter(p => p.toString() !== userId.toString());
        
        otherParticipants.forEach(participantId => {
          io.to(`user:${participantId.toString()}`).emit('user_typing', {
            conversationId,
            userId,
            isTyping: true
          });
        });
      }
    } catch (error) {
      console.error('Error handling typing_start:', error);
    }
  });
  
  socket.on('typing_end', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;
      
      // Update typing status in conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (conversation) {
        await conversation.updateTypingStatus(userId, false);
        
        // Notify other participants
        const otherParticipants = conversation.participants
          .filter(p => p.toString() !== userId.toString());
        
        otherParticipants.forEach(participantId => {
          io.to(`user:${participantId.toString()}`).emit('user_typing', {
            conversationId,
            userId,
            isTyping: false
          });
        });
      }
    } catch (error) {
      console.error('Error handling typing_end:', error);
    }
  });
  
  // Handle messages read events
  socket.on('mark_messages_read', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;
      
      // Mark messages as read in conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (conversation) {
        const messagesUpdated = await conversation.markMessagesAsRead(userId);
        
        if (messagesUpdated > 0) {
          // Get messages that were marked as read by this user
          const messagesRead = [];
          
          for (const page of conversation.messagePages) {
            const pageMessages = page.messages.filter(
              msg => msg.sender.toString() !== userId.toString() && 
                   msg.readBy.some(id => id.toString() === userId.toString())
            );
            messagesRead.push(...pageMessages.map(msg => ({
              _id: msg._id,
              sender: msg.sender
            })));
          }
          
          // Group by sender and notify
          const messagesBySender = {};
          messagesRead.forEach(msg => {
            const senderId = msg.sender.toString();
            if (!messagesBySender[senderId]) {
              messagesBySender[senderId] = [];
            }
            messagesBySender[senderId].push(msg._id.toString());
          });
          
          // Notify each sender
          Object.keys(messagesBySender).forEach(senderId => {
            io.to(`user:${senderId}`).emit('messages_read', {
              conversationId,
              messageIds: messagesBySender[senderId],
              readBy: userId
            });
          });
        }
      }
    } catch (error) {
      console.error('Error handling mark_messages_read:', error);
    }
  });
  
  // Handle active in conversation event
  socket.on('active_in_conversation', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;
      
      // Join the conversation room
      socket.join(`conversation:${conversationId}`);
      
      // Get conversation and update user's online status
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (conversation) {
        // Notify other participants
        const otherParticipants = conversation.participants
          .filter(p => p.toString() !== userId.toString());
        
        otherParticipants.forEach(participantId => {
          io.to(`user:${participantId.toString()}`).emit('user_active_in_conversation', {
            conversationId,
            userId
          });
        });
      }
    } catch (error) {
      console.error('Error handling active_in_conversation:', error);
    }
  });
  
  // Handle inactive in conversation event
  socket.on('inactive_in_conversation', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId) return;
      
      // Leave the conversation room
      socket.leave(`conversation:${conversationId}`);
      
      // Get conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (conversation) {
        // Stop typing and notify others
        await conversation.updateTypingStatus(userId, false);
        
        // Notify other participants
        const otherParticipants = conversation.participants
          .filter(p => p.toString() !== userId.toString());
        
        otherParticipants.forEach(participantId => {
          io.to(`user:${participantId.toString()}`).emit('user_inactive_in_conversation', {
            conversationId,
            userId
          });
          
          // Also send typing stopped event
          io.to(`user:${participantId.toString()}`).emit('user_typing', {
            conversationId,
            userId,
            isTyping: false
          });
        });
      }
    } catch (error) {
      console.error('Error handling inactive_in_conversation:', error);
    }
  });
  
  // Handle message reactions
  socket.on('add_reaction', async (data) => {
    try {
      const { messageId, conversationId, reaction } = data;
      if (!messageId || !conversationId || !reaction) return;
      
      // Find conversation first
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (!conversation) return;
      
      // Find the message in the conversation
      let foundMessage = null;
      let senderId = null;
      
      for (const page of conversation.messagePages) {
        const msg = page.messages.find(m => m._id.toString() === messageId);
        if (msg) {
          foundMessage = msg;
          senderId = msg.sender.toString();
          
          // Add reaction if it doesn't exist
          const existingReaction = msg.reactions.find(
            r => r.user.toString() === userId && r.reaction === reaction
          );
          
          if (!existingReaction) {
            msg.reactions.push({
              user: userId,
              reaction,
              createdAt: new Date()
            });
          }
          
          break;
        }
      }
      
      if (foundMessage) {
        await conversation.save();
        
        // Notify participants
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== userId) {
            io.to(`user:${participantId.toString()}`).emit('message_reaction', {
              messageId,
              conversationId,
              userId,
              reaction
            });
          }
        });
      }
    } catch (error) {
      console.error('Error handling add_reaction:', error);
    }
  });
  
  socket.on('remove_reaction', async (data) => {
    try {
      const { messageId, conversationId, reaction } = data;
      if (!messageId || !conversationId || !reaction) return;
      
      // Find conversation first
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });
      
      if (!conversation) return;
      
      // Find the message in the conversation
      let foundMessage = null;
      
      for (const page of conversation.messagePages) {
        const msgIndex = page.messages.findIndex(m => m._id.toString() === messageId);
        if (msgIndex !== -1) {
          foundMessage = page.messages[msgIndex];
          
          // Remove the reaction
          page.messages[msgIndex].reactions = page.messages[msgIndex].reactions.filter(
            r => !(r.user.toString() === userId && r.reaction === reaction)
          );
          
          break;
        }
      }
      
      if (foundMessage) {
        await conversation.save();
        
        // Notify participants
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== userId) {
            io.to(`user:${participantId.toString()}`).emit('message_reaction_removed', {
              messageId,
              conversationId,
              userId,
              reaction
            });
          }
        });
      }
    } catch (error) {
      console.error('Error handling remove_reaction:', error);
    }
  });
};

// Function to update user's online status in conversations and database
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    // Update in all conversations
    const conversations = await Conversation.find({
      participants: userId
    });
    
    for (const conversation of conversations) {
      await conversation.updateOnlineStatus(userId, isOnline);
      
      // Notify other participants
      const otherParticipants = conversation.participants
        .filter(p => p.toString() !== userId.toString());
      
      // Get user details for the status update
      const user = await User.findById(userId)
        .select('_id name fullName profileImage');
      
      const statusUpdate = formatUserStatus(user, isOnline);
      
      // Notify each participant - Only if global.io exists
      if (global.io) {
        for (const participantId of otherParticipants) {
          global.io.to(`user:${participantId.toString()}`).emit('contact_status_update', {
            userId: statusUpdate._id,
            isOnline: statusUpdate.isOnline,
            lastOnline: statusUpdate.lastOnline
          });
        }
      }
    }
    
    // Update in user model too
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastOnline: isOnline ? undefined : new Date()
    });
    
    console.log(`Updated online status for user ${userId} to ${isOnline}`);
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
};

// Middleware to authenticate socket connections
const authenticateSocket = async (socket, next) => {
  try {
    // Auth data is now in the handshake.auth object from the client
    const auth = socket.handshake.auth;
    const userId = auth.userId;
    const token = auth.token;
    
    // Log what we received
    console.log('Socket auth received:', { 
      hasUserId: !!userId, 
      hasToken: !!token 
    });
    
    if (!userId) {
      console.error('Socket auth error: No user ID provided');
      return next(new Error('User ID is required for authentication'));
    }
    
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error('Socket auth error: User not found', userId);
      return next(new Error('User not found'));
    }
    
    // Attach user ID to socket for later use
    socket.userId = userId;
    console.log(`Socket authenticated for user ${userId}`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Socket.IO initialization
const initializeSocketIO = (socketIO) => {
  io = socketIO;
  
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`New socket connection: ${socket.id} for user ${userId}`);
    
    // Set up events for this socket
    setupSocketEvents(io, socket, userId);
  });
  
  console.log('Socket.IO initialized');
  
  return io;
};

// Check if a user is online
const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

// Function to deliver a message to a specific user
const deliverMessageToUser = (userId, messageData) => {
  if (isUserOnline(userId)) {
    global.io.to(`user:${userId}`).emit('new_message', messageData);
    return true;
  }
  return false;
};

// Function to emit typing status update to conversation participants
const emitTypingStatus = (conversationId, userId, isTyping) => {
  global.io.to(`conversation:${conversationId}`).emit('user_typing', {
    conversationId,
    userId,
    isTyping
  });
};

// Get the initialized io instance
const getIO = () => {
  if (!io) {
    console.warn('Socket.IO accessed before initialization');
    
    // Return a dummy io object that supports basic operations
    // This prevents errors when socket is not initialized
    return {
      to: () => ({
        emit: () => {
          console.warn('Attempted to emit event when socket.io is not initialized');
        }
      }),
      emit: () => {
        console.warn('Attempted to emit event when socket.io is not initialized');
      }
    };
  }
  return io;
};

// Export functions for use elsewhere
module.exports = {
  initializeSocketIO,
  isUserOnline,
  deliverMessageToUser,
  emitTypingStatus,
  getIO
}; 