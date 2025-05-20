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

// Store profile in cloud endpoint
router.post('/cloud-store', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
    
    // Find and update user
    const email = userData.email.toLowerCase().trim();
    console.log(`Cloud profile storage for user: ${email}`);
    
    let user = await User.findOne({ email });
    
    if (user) {
      // Special handling for profile image to prevent data loss
      if (!userData.profileImage && user.profileImage) {
        console.log('Client missing profile image, preserving existing image');
        userData.profileImage = user.profileImage;
      }
      
      // Special handling for name to prevent inconsistencies
      if (!userData.name && user.name) {
        console.log('Client missing name, preserving existing name');
        userData.name = user.name;
      } else if (userData.name && userData.name !== user.name) {
        console.log(`Name change detected: "${user.name}" -> "${userData.name}"`);
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
    } else {
      user = await User.create({
        ...userData,
        email,
        lastSyncTime: new Date()
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile stored successfully',
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone || '',
        address: user.address || '',
        age: user.age || '',
        medicalInfo: user.medicalInfo || {
          conditions: '',
          medications: '',
          allergies: '',
          bloodType: ''
        },
        homeLocation: user.homeLocation,
        reminders: user.reminders || [],
        memories: user.memories || [],
        emergencyContacts: user.emergencyContacts || [],
        caregiverEmail: user.caregiverEmail,
        lastSyncTime: user.lastSyncTime
      }
    });
  } catch (error) {
    console.error('Cloud profile storage error:', error);
    res.status(500).json({
      success: false, 
      message: error.message
    });
  }
});

// Get profile from cloud by email
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
    console.log(`Cloud profile retrieval for user: ${normalizedEmail}`);
    
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
        medicalInfo: user.medicalInfo || {
          conditions: '',
          medications: '',
          allergies: '',
          bloodType: ''
        },
        homeLocation: user.homeLocation,
        reminders: user.reminders || [],
        memories: user.memories || [],
        emergencyContacts: user.emergencyContacts || [],
        caregiverEmail: user.caregiverEmail,
        lastSyncTime: user.lastSyncTime
      }
    });
  } catch (error) {
    console.error('Cloud profile retrieval error:', error);
    res.status(500).json({
      success: false, 
      message: error.message
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