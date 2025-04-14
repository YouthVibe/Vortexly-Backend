const Notification = require('../models/Notification');
const User = require('../models/User');
const { validateObjectId } = require('../utils/validation');
const { sendPushNotification } = require('../utils/pushNotification');

// Create a new notification
exports.createNotification = async (data, req) => {
  try {
    // Validate required fields
    if (!data.recipient || !data.sender || !data.type || !data.message) {
      throw new Error('Missing required notification fields');
    }

    // Don't create notifications if the user is notifying themselves
    if (data.recipient.toString() === data.sender.toString()) {
      return null;
    }

    // Create the notification
    const notification = await Notification.create(data);
    
    // Update the user's unread notification count
    await User.findByIdAndUpdate(data.recipient, {
      $inc: { unreadNotifications: 1 }
    });

    // Populate sender information for real-time notification
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name fullName profileImage')
      .lean();
    
    // Send real-time notification if req is available (via socket)
    if (req && req.app) {
      const sendNotification = req.app.get('sendNotification');
      if (sendNotification && typeof sendNotification === 'function') {
        sendNotification(data.recipient.toString(), populatedNotification);
      }
    }

    // Get the recipient's push token
    const recipient = await User.findById(data.recipient).select('pushToken');
    
    // Send push notification if recipient has a push token
    if (recipient && recipient.pushToken) {
      try {
        await sendPushNotification(
          recipient.pushToken,
          'New Notification',
          data.message,
          { notificationId: notification._id }
        );
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Get all notifications for a user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get notifications with populated sender data
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name fullName profileImage')
      .lean();

    // Get total count for pagination
    const total = await Notification.countDocuments({ recipient: userId });
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    if (!validateObjectId(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if the notification belongs to the user
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Only update if not already read
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      
      // Decrement the user's unread notification count
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { unreadNotifications: -1 }
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Error updating notification' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Count unread notifications to adjust the user's count
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });
    
    // Update all unread notifications to read
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );
    
    // Reset the user's unread notification count
    if (unreadCount > 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { unreadNotifications: 0 }
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Error updating notifications' });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Error fetching unread count' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    if (!validateObjectId(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if the notification belongs to the user
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // If the notification was unread, decrement the user's unread count
    if (!notification.isRead) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { unreadNotifications: -1 }
      });
    }
    
    await Notification.findByIdAndDelete(notificationId);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Error deleting notification' });
  }
};
