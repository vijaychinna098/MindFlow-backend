const express = require('express');
const router = express.Router();
const User = require('../models/user');
const multer = require('multer');
const path = require('path');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/profile-images'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg and .png files are allowed'));
    }
  }
});

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

// Profile sync endpoint for compatibility with the app
router.post('/profile', async (req, res) => {
  try {
    if (!req.body || !req.body.clientData || !req.body.clientData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sync data provided'
      });
    }
    
    const { clientData, lastSyncTime } = req.body;
    const email = clientData.email.toLowerCase().trim();
    console.log(`Profile sync request for user: ${email}`);
    
    // Find existing user in database
    let user = await User.findOne({ email });
    
    if (user) {
      console.log(`Existing user found for profile sync: ${email}`);
      
      // Special handling for profile image to prevent data loss
      if (!clientData.profileImage && user.profileImage) {
        console.log('Client missing profile image, preserving existing image');
        clientData.profileImage = user.profileImage;
      }
      
      // Special handling for name to prevent data loss
      if (!clientData.name && user.name) {
        console.log('Client missing name, preserving existing name');
        clientData.name = user.name;
      }
      
      // Update with merged fields
      user = await User.findOneAndUpdate(
        { email },
        { 
          $set: {
            ...clientData,
            lastSyncTime: new Date()
          }
        },
        { new: true }
      );
    } else {
      console.log(`Creating new user during profile sync: ${email}`);
      user = await User.create({
        ...clientData,
        email,
        lastSyncTime: new Date()
      });
    }
    
    return res.status(200).json({
      success: true,
      user: {
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
    console.error('Error in profile sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync profile data',
      error: error.message
    });
  }
});

// Enhanced Profile Sync Endpoint
// This endpoint is designed to ensure profile consistency across devices
router.post('/enhanced-profile-sync', async (req, res) => {
  try {
    if (!req.body || !req.body.email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for profile sync'
      });
    }
    
    const { email, deviceId, lastSyncTime, profileData } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Enhanced profile sync request for: ${normalizedEmail} from device: ${deviceId}`);
    
    // Find existing user in database
    let user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Track changes for selective updating
    const changes = {
      nameChanged: false,
      profileImageChanged: false
    };
    
    // Conflict resolution for profile data
    if (profileData) {
      // Handle name conflict - server wins in case of conflict
      if (profileData.name && (!user.lastNameUpdate || 
          (profileData.lastNameUpdate && new Date(profileData.lastNameUpdate) > new Date(user.lastNameUpdate)))) {
        user.name = profileData.name;
        user.lastNameUpdate = profileData.lastNameUpdate || new Date();
        changes.nameChanged = true;
      }
      
      // Handle profile image conflict - latest upload wins
      if (profileData.profileImage && (!user.lastProfileImageUpdate || 
          (profileData.lastProfileImageUpdate && new Date(profileData.lastProfileImageUpdate) > new Date(user.lastProfileImageUpdate)))) {
        user.profileImage = profileData.profileImage;
        user.lastProfileImageUpdate = profileData.lastProfileImageUpdate || new Date();
        changes.profileImageChanged = true;
      }
    }
    
    // Update device sync information
    user.lastSyncDeviceId = deviceId;
    user.lastSyncTime = new Date();
    
    // Save the updated user
    await user.save();
    
    // Prepare response with sync results
    return res.status(200).json({
      success: true,
      changes,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        lastNameUpdate: user.lastNameUpdate,
        lastProfileImageUpdate: user.lastProfileImageUpdate,
        lastSyncTime: user.lastSyncTime
      }
    });
  } catch (error) {
    console.error('Error in enhanced profile sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync profile data',
      error: error.message
    });
  }
});

// Profile image upload endpoint specifically for sync purposes
router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image provided'
      });
    }
    
    if (!req.body.email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const email = req.body.email.toLowerCase().trim();
    const deviceId = req.body.deviceId || 'unknown';
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Create image URL based on server configuration
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/profile-images/${req.file.filename}`;
    
    // Update user profile with new image
    user.profileImage = imageUrl;
    user.lastProfileImageUpdate = new Date();
    user.lastUpdatedBy = deviceId;
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
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

// Endpoint to notify other devices about profile updates
router.post('/notify-profile-update', async (req, res) => {
  try {
    const { email, deviceId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update the lastUpdatedBy field to trigger sync on other devices
    user.lastUpdatedBy = deviceId || 'manual-sync';
    user.lastSyncTime = new Date();
    await user.save();
    
    // Here we would typically trigger a push notification to other devices
    // This would require Firebase Cloud Messaging or a similar service
    
    return res.status(200).json({
      success: true,
      message: 'Profile update notification sent'
    });
  } catch (error) {
    console.error('Error sending profile update notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send profile update notification',
      error: error.message
    });
  }
});

// Endpoint to force a profile sync across devices
router.post('/force-profile-sync', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update timestamp to force sync on all devices
    user.lastSyncTime = new Date();
    user.forceSyncFlag = true; // Add a flag to force sync even if timestamps match
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Force sync triggered for all devices',
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Error triggering force sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger force sync',
      error: error.message
    });
  }
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

module.exports = router;