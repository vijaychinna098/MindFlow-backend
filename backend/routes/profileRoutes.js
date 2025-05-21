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

// Specific endpoint for profile image synchronization
router.post('/image', async (req, res) => {
  try {
    const { email, profileImage } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Profile image sync request for: ${normalizedEmail}`);
    
    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile image is required'
      });
    }
    
    // Find the user and update just the profile image
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { 
        $set: {
          profileImage: profileImage,
          lastSyncTime: new Date()
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log(`Profile image updated for: ${normalizedEmail}`);
    
    res.status(200).json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        lastSyncTime: user.lastSyncTime
      }
    });
  } catch (error) {
    console.error('Profile image sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync profile image',
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

// Get just the profile image by email - add support for multiple URL patterns
router.get('/image/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Getting profile image for: ${normalizedEmail}`);
    
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.profileImage) {
      return res.status(404).json({
        success: false,
        message: 'No profile image found for this user'
      });
    }
    
    res.status(200).json({
      success: true,
      profileImage: user.profileImage,
      name: user.name
    });
  } catch (error) {
    console.error('Profile image retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile image',
      error: error.message
    });
  }
});

// Alternative URL patterns for image retrieval for better compatibility
router.get('/:email/image', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Getting profile image (alt URL) for: ${normalizedEmail}`);
    
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.profileImage) {
      return res.status(404).json({
        success: false,
        message: 'No profile image found for this user'
      });
    }
    
    res.status(200).json({
      success: true,
      profileImage: user.profileImage,
      name: user.name
    });
  } catch (error) {
    console.error('Profile image retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile image',
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