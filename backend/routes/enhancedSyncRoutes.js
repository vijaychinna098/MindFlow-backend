const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { 
  syncUserProfile, 
  processProfileImage, 
  notifyProfileUpdate, 
  forceProfileSync, 
  checkUserNeedsSync 
} = require('../sync-updates');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create directory if it doesn't exist
    const dir = path.join(__dirname, '../uploads/profile-images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
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
  console.log("Enhanced sync API ping received");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Enhanced sync API is available'
  });
});

// Base route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Enhanced sync API is running',
    endpoints: [
      '/profile',
      '/upload-profile-image',
      '/notify-profile-update',
      '/force-profile-sync',
      '/check-sync'
    ]
  });
});

// Enhanced profile sync endpoint
router.post('/profile', async (req, res) => {
  try {
    const { email, deviceId, profileData } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const result = await syncUserProfile(email, deviceId || 'unknown', profileData);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in profile sync endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing profile sync',
      error: error.message
    });
  }
});

// Profile image upload endpoint
router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image provided'
      });
    }
    
    const { email, deviceId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const result = await processProfileImage(req.file, email, deviceId || 'unknown');
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in profile image upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing profile image',
      error: error.message
    });
  }
});

// Notify profile update endpoint
router.post('/notify-profile-update', async (req, res) => {
  try {
    const { email, deviceId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const result = await notifyProfileUpdate(email, deviceId || 'unknown');
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in notify profile update:', error);
    return res.status(500).json({
      success: false,
      message: 'Error notifying profile update',
      error: error.message
    });
  }
});

// Force profile sync endpoint
router.post('/force-profile-sync', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const result = await forceProfileSync(email);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in force profile sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Error forcing profile sync',
      error: error.message
    });
  }
});

// Check if sync is needed endpoint
router.post('/check-sync', async (req, res) => {
  try {
    const { email, deviceId, lastSyncTime } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const result = await checkUserNeedsSync(email, deviceId || 'unknown', lastSyncTime);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in check sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking sync status',
      error: error.message
    });
  }
});

module.exports = router;
