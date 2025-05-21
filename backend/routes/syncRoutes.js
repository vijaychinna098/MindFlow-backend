const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Ping endpoint for connectivity check
router.get('/ping', (req, res) => {
  console.log("Sync API ping received");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Sync API is available'
  });
});

// Base route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sync API is running'
  });
});

// Endpoint for checking if a user has updates
router.get('/check/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const lastCheck = req.headers['x-last-check'] || '1970-01-01T00:00:00.000Z';
    const deviceId = req.headers['x-device-id'] || 'unknown';
    
    console.log(`Sync check for ${email} from device ${deviceId}, last check: ${lastCheck}`);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if the user has been updated since the last check
    const lastCheckDate = new Date(lastCheck);
    const userUpdatedAt = user.lastSyncTime || user.updatedAt || new Date(0);
    
    // If the user has updates, or if this is from a different device
    if (userUpdatedAt > lastCheckDate || (user.lastUpdatedBy && user.lastUpdatedBy !== deviceId)) {
      console.log(`Updates found for ${normalizedEmail}, sending profile`);
      
      return res.status(200).json({
        success: true,
        hasUpdates: true,
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          profileImage: user.profileImage,
          phone: user.phone || '',
          address: user.address || '',
          age: user.age || '',
          medicalInfo: user.medicalInfo || {},
          lastSyncTime: new Date().toISOString()
        }
      });
    }
    
    console.log(`No updates found for ${normalizedEmail}`);
    
    return res.status(200).json({
      success: true,
      hasUpdates: false
    });
  } catch (error) {
    console.error('Sync check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for updates',
      error: error.message
    });
  }
});

// Endpoint for synchronizing user profiles across devices
router.post('/profile', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
    
    const normalizedEmail = userData.email.toLowerCase().trim();
    console.log(`Profile sync request for user: ${normalizedEmail}`);
    
    // Find existing user
    let user = await User.findOne({ email: normalizedEmail });
    
    if (user) {
      // Handle special fields carefully
      
      // For profile image - never lose an existing image
      if (!userData.profileImage && user.profileImage) {
        console.log('Preserving existing profile image during sync');
        userData.profileImage = user.profileImage;
      }
      
      // For name changes - check timestamps
      if (userData.name && userData.name !== user.name) {
        // Check if this update is newer than the existing data
        const updateTimestamp = userData.updatedAt || userData.lastUpdatedAt || new Date();
        const userTimestamp = user.updatedAt || user.lastUpdatedAt || user.lastSyncTime || new Date(0);
        
        if (new Date(updateTimestamp) > new Date(userTimestamp)) {
          console.log(`Accepting newer name change: "${user.name}" -> "${userData.name}"`);
        } else {
          console.log(`Rejecting older name change, keeping: "${user.name}"`);
          userData.name = user.name;
        }
      }
      
      // Update user with merged data
      user = await User.findOneAndUpdate(
        { email: normalizedEmail },
        { 
          $set: {
            ...userData,
            lastSyncTime: new Date()
          }
        },
        { new: true }
      );
      
      console.log(`User profile synchronized for: ${normalizedEmail}`);
    } else {
      // Create new user if not found
      user = await User.create({
        ...userData,
        email: normalizedEmail,
        lastSyncTime: new Date()
      });
      
      console.log(`New user created during sync: ${normalizedEmail}`);
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
        lastSyncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Profile sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to synchronize profile',
      error: error.message
    });
  }
});

// Endpoint for synchronizing just profile images
router.post('/image', async (req, res) => {
  try {
    const { email, profileImage } = req.body;
    
    if (!email || !profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Email and profile image are required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Image sync request for: ${normalizedEmail}`);
    
    // Find user and update only the profile image
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
    
    console.log(`Profile image synced for: ${normalizedEmail}`);
    
    res.status(200).json({
      success: true,
      profileImage: user.profileImage,
      name: user.name,
      lastSyncTime: user.lastSyncTime
    });
  } catch (error) {
    console.error('Image sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync image',
      error: error.message
    });
  }
});

// Notification endpoint for real-time updates
router.post('/notify', async (req, res) => {
  try {
    const { email, deviceId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Notification for user: ${normalizedEmail} from device: ${deviceId || 'unknown'}`);
    
    // In a real implementation, you would notify other devices
    // For now, just update the user's lastSyncTime
    await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { lastSyncTime: new Date() } }
    );
    
    res.status(200).json({
      success: true,
      message: 'Notification received'
    });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process notification',
      error: error.message
    });
  }
});

// Force immediate sync for all connected devices
router.get('/trigger/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Triggering sync for all devices of user: ${normalizedEmail}`);
    
    // Update lastSyncTime to trigger update checks
    await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { lastSyncTime: new Date() } }
    );
    
    res.status(200).json({
      success: true,
      message: 'Sync triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      error: error.message
    });
  }
});

// Additional endpoint for aggressive profile image synchronization
router.post('/aggressive-image', async (req, res) => {
  try {
    const { email, profileImage } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`AGGRESSIVE IMAGE SYNC: Request for ${normalizedEmail}`);
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Handle both upload and download
    if (profileImage) {
      console.log(`AGGRESSIVE IMAGE SYNC: Updating server image for ${normalizedEmail}`);
      
      // Update the user's profile image
      await User.findOneAndUpdate(
        { email: normalizedEmail },
        { 
          $set: { 
            profileImage: profileImage,
            lastSyncTime: new Date()
          } 
        }
      );
      
      res.status(200).json({
        success: true,
        message: 'Profile image updated successfully',
        profileImage: profileImage
      });
    } else if (user.profileImage) {
      console.log(`AGGRESSIVE IMAGE SYNC: Sending server image to client for ${normalizedEmail}`);
      
      // Return the existing profile image
      res.status(200).json({
        success: true,
        profileImage: user.profileImage,
        name: user.name
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No profile image available'
      });
    }
  } catch (error) {
    console.error('Aggressive image sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync image',
      error: error.message
    });
  }
});

// One-way image download (no image upload required)
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
    console.log(`Image download request for: ${normalizedEmail}`);
    
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
    console.error('Image download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile image',
      error: error.message
    });
  }
});

module.exports = router; 