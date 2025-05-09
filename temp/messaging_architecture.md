# YouthVibes Private Messaging Architecture

This document outlines the private messaging system implemented in the YouthVibes application, which provides real-time messaging with features like read receipts, typing indicators, and online status.

## Database Models

### Conversation Model

- **Participants**: Array of user IDs involved in the conversation
- **Last Message**: Reference to the most recent message
- **Message Pagination**: Each conversation tracks how many messages it contains and how many pages (10 messages per page)
- **Online Status**: Tracks online status for each participant
- **Typing Indicators**: Tracks who is currently typing in the conversation
- **Last Online**: Records when each participant was last online
- **Read Receipts**: Tracks if messages have been checked by recipients
- **Unread Counts**: Keeps count of unread messages for each participant

### Message Model

- **Pagination**: Messages are grouped into pages of 10 for efficient loading
- **Delivery Status**: Tracks whether a message is sent, delivered, or read
- **Read By**: Array of users who have read the message
- **Read Receipts**: Timestamps of when each user read the message
- **Media Support**: Images, videos, and audio with metadata like dimensions and duration
- **Replies**: Support for replying to specific messages
- **Reactions**: Support for emoji reactions to messages
- **Editing**: Support for editing messages with history tracking

## API Endpoints

### Conversations
- `GET /api/messages/conversations` - Get all user conversations
- `POST /api/messages/group` - Create a group conversation
- `GET /api/messages/participants/:conversationId` - Get conversation participants

### Messages
- `GET /api/messages/:conversationId` - Get messages for a conversation (paginated)
- `POST /api/messages` - Send a new message
- `PUT /api/messages/:conversationId/read` - Mark all messages as read
- `DELETE /api/messages/:messageId` - Delete a message
- `PUT /api/messages/:messageId/edit` - Edit a message

### Presence & Status
- `PUT /api/messages/:conversationId/typing` - Update typing status
- `PUT /api/messages/status/online` - Update online status

### Reactions
- `POST /api/messages/reactions/:messageId` - Add a reaction to a message
- `DELETE /api/messages/reactions/:messageId` - Remove a reaction

## Real-time Features with Socket.IO

The system uses Socket.IO for real-time communication with these events:

### Client-to-Server Events
- `authenticate` - Authenticate socket connection with user ID
- `join_conversation` - Join a conversation room
- `leave_conversation` - Leave a conversation room
- `typing` - Indicate user is typing
- `message_delivered` - Mark message as delivered
- `message_read` - Mark message as read

### Server-to-Client Events
- `authenticated` - Confirm successful authentication
- `user_typing` - Notify when a user is typing
- `contact_status_update` - Notify when a contact's online status changes
- `user_active_in_conversation` - Notify when a user enters a conversation
- `user_inactive_in_conversation` - Notify when a user leaves a conversation
- `message_status_update` - Update on message delivery/read status
- `new_notification` - Push a new notification

## How Pagination Works

1. Messages are stored with a `pageNumber` field
2. When requesting messages, the client specifies which page to load
3. The server returns exactly 10 messages for that page
4. The client can request additional pages as needed (older messages)
5. New messages automatically calculate their page number based on total message count

## Benefits of the Architecture

1. **Efficient Data Loading**: Only loads 10 messages at a time to reduce bandwidth
2. **Real-time Interactions**: Provides immediate feedback for typing, read status, etc.
3. **Comprehensive Metadata**: Tracks all relevant status information
4. **Scalable**: Can handle many conversations with large message histories
5. **Privacy Controls**: Users can control visibility of their online status and read receipts

## Implementation Considerations

- The system uses MongoDB's Map data type for efficient storage of user-specific data
- Socket rooms are used to manage real-time updates efficiently
- Both conversation-specific and global user status are tracked
- Messages use optimistic UI updates with confirmation from the server
