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

// Endpoint to notify of profile changes
router.post('/notify', async (req, res) => {
  try {
    const { email, deviceId, timestamp } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    console.log(`Sync notification for user: ${email} from device: ${deviceId || 'unknown'}`);
    
    // Update user's last sync time
    if (email) {
      try {
        await User.findOneAndUpdate(
          { email: email.toLowerCase().trim() },
          { 
            $set: {
              lastSyncTime: new Date(),
              lastSyncDevice: deviceId || 'unknown'
            }
          }
        );
      } catch (dbError) {
        console.log(`Error updating user sync time: ${dbError.message}`);
      }
    }
    
    // In a real implementation, this could trigger push notifications
    // For now, just acknowledge the notification
    res.status(200).json({
      success: true,
      message: 'Sync notification received',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process sync notification',
      error: error.message
    });
  }
});

// Check for updates endpoint
router.get('/check/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const lastCheck = req.headers['x-last-check'] || '1970-01-01T00:00:00.000Z';
    const deviceId = req.headers['x-device-id'] || 'unknown';
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    console.log(`Update check for user: ${email} from device: ${deviceId}, last check: ${lastCheck}`);
    
    // Get the user from the database
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if there are updates since last check
    const lastCheckDate = new Date(lastCheck);
    const lastUpdateDate = user.updatedAt || user.lastSyncTime || new Date();
    
    const hasUpdates = lastUpdateDate > lastCheckDate && 
                       (!user.lastSyncDevice || user.lastSyncDevice !== deviceId);
    
    if (hasUpdates) {
      console.log(`Updates found for user: ${email}, sending profile data`);
      
      res.status(200).json({
        success: true,
        hasUpdates: true,
        lastUpdate: lastUpdateDate,
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
    } else {
      console.log(`No updates found for user: ${email}`);
      
      res.status(200).json({
        success: true,
        hasUpdates: false,
        lastCheck: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Update check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for updates',
      error: error.message
    });
  }
});

// Trigger sync endpoint
router.get('/trigger-sync/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    console.log(`Sync trigger for user: ${email}`);
    
    // In a real implementation, this would trigger push notifications
    // For now, just acknowledge the trigger
    res.status(200).json({
      success: true,
      message: 'Sync triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      error: error.message
    });
  }
});

module.exports = router; 