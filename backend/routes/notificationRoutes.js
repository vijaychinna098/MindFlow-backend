const express = require('express');
const router = express.Router();
const admin = require('../firebaseConfig');
const protect = require('../middlewares/protect');
const User = require('../models/user');
const axios = require('axios');
const Notification = require('../models/notification');

/**
 * @route   POST /api/notifications/register
 * @desc    Register a device token for a user
 * @access  Private
 */
router.post('/register', protect, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id; // Get user ID from the auth middleware

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    // Update user document with FCM token
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { fcmToken: token } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully'
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register device token',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/send
 * @desc    Send notification to a specific user or topic
 * @access  Private
 */
router.post('/send', protect, async (req, res) => {
  try {
    const { title, body, token, topic, data, userId } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Notification title and body are required' 
      });
    }

    // Prepare notification message
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    let response;

    // Send to a specific device token
    if (token) {
      message.token = token;
      response = await admin.messaging().send(message);
    } 
    // Send to a topic
    else if (topic) {
      message.topic = topic;
      response = await admin.messaging().send(message);
    } 
    // Send to a specific user by ID
    else if (userId) {
      const user = await User.findById(userId);
      if (!user || !user.fcmToken) {
        return res.status(404).json({
          success: false,
          message: 'User not found or does not have a registered device token'
        });
      }
      
      message.token = user.fcmToken;
      response = await admin.messaging().send(message);
    }
    // No target specified
    else {
      return res.status(400).json({ 
        success: false, 
        message: 'Either token, topic, or userId must be provided' 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      response
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/subscribe
 * @desc    Subscribe a device to a topic
 * @access  Private
 */
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { token, topic } = req.body;

    if (!token || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Token and topic are required'
      });
    }

    const response = await admin.messaging().subscribeToTopic(token, topic);

    return res.status(200).json({
      success: true,
      message: `Successfully subscribed to topic: ${topic}`,
      response
    });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to subscribe to topic',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/unsubscribe
 * @desc    Unsubscribe a device from a topic
 * @access  Private
 */
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { token, topic } = req.body;

    if (!token || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Token and topic are required'
      });
    }

    const response = await admin.messaging().unsubscribeFromTopic(token, topic);

    return res.status(200).json({
      success: true,
      message: `Successfully unsubscribed from topic: ${topic}`,
      response
    });
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from topic',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/send-expo
 * @desc    Send notification using Expo push notification service
 * @access  Private
 */
router.post('/send-expo', protect, async (req, res) => {
  try {
    const { title, body, token, userId, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Notification title and body are required'
      });
    }

    if (!token && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Either token or userId must be provided'
      });
    }

    let pushToken = token;

    // If userId is provided, get the user's token
    if (userId && !token) {
      const user = await User.findById(userId);
      if (!user || !user.expoPushToken) {
        return res.status(404).json({
          success: false,
          message: 'User not found or does not have a registered push token'
        });
      }
      pushToken = user.expoPushToken;
    }

    // Prepare the message payload
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {}
    };

    // Send the notification via Expo's push notification service
    const response = await axios.post('https://exp.host/--/api/v2/push/send', 
      message,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      response: response.data
    });
  } catch (error) {
    console.error('Error sending Expo notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/register-expo
 * @desc    Register an Expo push token for a user
 * @access  Private
 */
router.post('/register-expo', protect, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Expo Push Token is required'
      });
    }

    // Update user document with Expo Push Token
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { expoPushToken: token } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Expo Push Token registered successfully'
    });
  } catch (error) {
    console.error('Error registering Expo Push Token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register Expo Push Token',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/notifications/unread/:userId
 * @desc    Get count of unread notifications for a user
 * @access  Private
 */
router.get('/unread/:userId', protect, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access these notifications'
      });
    }
    
    // Find all unread notifications for the user
    const unreadCount = await Notification.countDocuments({
      userId,
      read: false
    });
    
    return res.status(200).json({
      success: true,
      count: unreadCount
    });
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread notifications count',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/notifications/user/:userId
 * @desc    Get all notifications for a user
 * @access  Private
 */
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access these notifications'
      });
    }
    
    // Find all notifications for the user, sorted by creation date (newest first)
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to 50 most recent notifications
    
    return res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user notifications',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:notificationId/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    
    // Find the notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if the user owns this notification
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this notification'
      });
    }
    
    // Update the notification to mark as read
    notification.read = true;
    await notification.save();
    
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

module.exports = router; 