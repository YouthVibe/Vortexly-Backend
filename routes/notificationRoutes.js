const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} = require('../controllers/notificationController');

// Protect all notification routes with authentication
router.use(authenticate);

// Get all notifications for the authenticated user
router.get('/', getNotifications);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Mark a specific notification as read
router.put('/:notificationId/read', markAsRead);

// Delete a notification
router.delete('/:notificationId', deleteNotification);

module.exports = router;
