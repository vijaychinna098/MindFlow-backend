const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Base route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Profile API is running'
  });
});

// Cloud storage endpoint for user profiles
router.post('/cloud-store', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
    
    const email = userData.email.toLowerCase().trim();
    console.log(`Cloud storage request for profile: ${email}`);
    
    // Find the user and update
    let user = await User.findOne({ email });
    
    if (user) {
      // Special handling for profile image to prevent data loss
      if (!userData.profileImage && user.profileImage) {
        console.log('Client missing profile image, preserving existing image');
        userData.profileImage = user.profileImage;
      }
      
      // Special handling for name to allow intentional updates
      if (!userData.name && user.name) {
        console.log('Client missing name, preserving existing name');
        userData.name = user.name;
      } else if (userData.name && userData.name !== user.name) {
        // Check if this is a recent update
        const isRecentUpdate = userData.updatedAt || userData.lastUpdatedAt;
        if (isRecentUpdate) {
          console.log(`Name change detected and accepted: "${user.name}" -> "${userData.name}"`);
        } else {
          console.log(`Name change detected but using existing: "${userData.name}" -> "${user.name}"`);
          userData.name = user.name;
        }
      }
      
      user = await User.findOneAndUpdate(
        { email },
        { 
          $set: {
            ...userData,
            lastSyncTime: new Date()
          }
        },
        { new: true }
      );
      
      console.log(`Profile updated for: ${email}`);
    } else {
      // Create new user
      user = await User.create({
        ...userData,
        email,
        lastSyncTime: new Date()
      });
      console.log(`New profile created for: ${email}`);
    }
    
    res.status(200).json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone || '',
        address: user.address || '',
        age: user.age || '',
        medicalInfo: user.medicalInfo || {},
        homeLocation: user.homeLocation || null,
        lastSyncTime: user.lastSyncTime || new Date()
      }
    });
  } catch (error) {
    console.error('Cloud profile storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store profile in cloud',
      error: error.message
    });
  }
});

// Get user profile by email
router.get('/cloud-get/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Getting cloud profile for user: ${normalizedEmail}`);
    
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone || '',
        address: user.address || '',
        age: user.age || '',
        medicalInfo: user.medicalInfo || {},
        homeLocation: user.homeLocation || null,
        lastSyncTime: user.lastSyncTime || new Date()
      }
    });
  } catch (error) {
    console.error('Cloud profile retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cloud profile',
      error: error.message
    });
  }
});

// Endpoint to notify of profile changes
router.post('/notify', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    console.log(`Profile change notification for: ${email}`);
    
    // In a real implementation, this could trigger push notifications
    // For now, just acknowledge the notification
    res.status(200).json({
      success: true,
      message: 'Notification received'
    });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process notification'
    });
  }
});

module.exports = router;