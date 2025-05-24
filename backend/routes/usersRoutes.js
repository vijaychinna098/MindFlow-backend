const express = require('express');
const router = express.Router();
const User = require('../models/user');
const protect = require('../middlewares/protect');

// Add a ping endpoint for connectivity check
router.get('/ping', (req, res) => {
  console.log("Users API ping received");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Users API is available'
  });
});

// Base route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Users API is running'
  });
});

// Endpoint for updating user data
router.post('/update', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
    
    const email = userData.email.toLowerCase().trim();
    console.log(`Update request for user: ${email}`);
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      console.log(`Updating existing user: ${email}`);
      
      // Special handling for profile image to prevent data loss
      if (!userData.profileImage && user.profileImage) {
        console.log('Client missing profile image, preserving existing image');
        userData.profileImage = user.profileImage;
      }
      
      // ALWAYS RESPECT NAME CHANGES - client is updating explicitly
      if (userData.name && userData.name !== user.name) {
        console.log(`Name change accepted: "${user.name}" -> "${userData.name}"`);
      } else if (!userData.name && user.name) {
        console.log('Client missing name, preserving existing name');
        userData.name = user.name;
      }
      
      // Update with merged fields
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
      console.log(`Creating new user: ${email}`);
      user = await User.create({
        ...userData,
        email,
        lastSyncTime: new Date()
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
    console.error('User update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message
    });
  }
});

// Store profile endpoint - Same functionality as update but different URI
router.post('/store-profile', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
    
    const email = userData.email.toLowerCase().trim();
    console.log(`Profile storage request for user: ${email}`);
    
    // Find the user and update
    let user = await User.findOne({ email });
    
    if (user) {
      // Special handling for profile image
      if (!userData.profileImage && user.profileImage) {
        userData.profileImage = user.profileImage;
        console.log('Preserved existing profile image');
      }
      
      // ALWAYS RESPECT NAME CHANGES - client is updating explicitly
      if (userData.name && userData.name !== user.name) {
        console.log(`Name change accepted in store-profile: "${user.name}" -> "${userData.name}"`);
      } else if (!userData.name && user.name) {
        userData.name = user.name;
        console.log('Preserved existing user name');
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
    console.error('Profile storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store user profile',
      error: error.message
    });
  }
});

// Get user by email
router.get('/get-profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Getting profile for user: ${normalizedEmail}`);
    
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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error.message
    });
  }
});

module.exports = router;