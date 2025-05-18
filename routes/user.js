// user.js (User update route)
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const protect = require('../middlewares/protect'); // Adjust the path as necessary

// Add a ping endpoint for connectivity check (must be at the beginning for proper routing)
router.get('/ping', (req, res) => {
  console.log("Server ping received");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Server is available'
  });
});

// Also add a root level ping for additional reliability
router.get('/', (req, res) => {
  console.log("Root path ping received");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'User API is available'
  });
});

// Protected update endpoint: only the authenticated user can update their own data
router.put('/', protect, async (req, res) => {
  try {
    const { id } = req.user; // Now req.user is set by the protect middleware
    const updatedUser = req.body;
    const result = await User.findByIdAndUpdate(
      id, 
      updatedUser, 
      { new: true, runValidators: true }
    );
    res.json({
      success: true,
      user: result
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Get user activities by user ID
// IMPORTANT: This route must be defined BEFORE the '/:userId' route
router.get('/activities/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`Activities requested for user ID: ${userId}`);
    
    // Generate sample activity data regardless of whether user exists
    const sampleActivities = [
      {
        type: 'App Login',
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        details: 'User logged into the application'
      },
      {
        type: 'Memory Game',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        details: 'Completed memory game with score 85%'
      },
      {
        type: 'Medication',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        details: 'Marked medication reminder as completed'
      },
      {
        type: 'Exercise',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        details: 'Completed daily exercise routine'
      },
      {
        type: 'App Usage',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        details: 'Viewed family photos'
      }
    ];
    
    // Try to find the user, but don't require it
    let user = null;
    try {
      user = await User.findById(userId);
      console.log(`User found: ${user ? 'Yes' : 'No'}`);
    } catch (userError) {
      console.log(`Error finding user: ${userError.message}`);
      // Continue execution even if user not found
    }
    
    // Always return activities, even if user not found
    res.json({
      success: true,
      activities: sampleActivities,
      userFound: !!user
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user activities'
    });
  }
});

// Get user by ID (used by caregivers to get patient info)
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
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
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

// Get user profile data
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        address: user.address,
        age: user.age,
        medicalInfo: user.medicalInfo,
        homeLocation: user.homeLocation
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ===== NEW ENDPOINTS FOR DATA SYNC =====

// Save reminders for a user
router.post('/sync/reminders', protect, async (req, res) => {
  try {
    const { reminders } = req.body;
    const userId = req.user.id;
    
    if (!reminders || !Array.isArray(reminders)) {
      return res.status(400).json({
        success: false,
        message: 'Reminders must be provided as an array'
      });
    }
    
    // Update user with reminders in a new field
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { reminders: reminders } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Reminders synced successfully',
      count: reminders.length
    });
  } catch (error) {
    console.error('Error syncing reminders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync reminders',
      error: error.message
    });
  }
});

// Get reminders for a user
router.get('/sync/reminders', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      reminders: user.reminders || []
    });
  } catch (error) {
    console.error('Error getting reminders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reminders',
      error: error.message
    });
  }
});

// Save memories for a user
router.post('/sync/memories', protect, async (req, res) => {
  try {
    const { memories } = req.body;
    const userId = req.user.id;
    
    if (!memories || !Array.isArray(memories)) {
      return res.status(400).json({
        success: false,
        message: 'Memories must be provided as an array'
      });
    }
    
    // Update user with memories in a new field
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { memories: memories } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Memories synced successfully',
      count: memories.length
    });
  } catch (error) {
    console.error('Error syncing memories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync memories',
      error: error.message
    });
  }
});

// Get memories for a user
router.get('/sync/memories', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      memories: user.memories || []
    });
  } catch (error) {
    console.error('Error getting memories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get memories',
      error: error.message
    });
  }
});

// Save emergency contacts for a user
router.post('/sync/contacts', protect, async (req, res) => {
  try {
    const { contacts } = req.body;
    const userId = req.user.id;
    
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: 'Contacts must be provided as an array'
      });
    }
    
    // Update user with contacts in a new field
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { emergencyContacts: contacts } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Emergency contacts synced successfully',
      count: contacts.length
    });
  } catch (error) {
    console.error('Error syncing emergency contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync emergency contacts',
      error: error.message
    });
  }
});

// Get emergency contacts for a user
router.get('/sync/contacts', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      contacts: user.emergencyContacts || []
    });
  } catch (error) {
    console.error('Error getting emergency contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get emergency contacts',
      error: error.message
    });
  }
});

// Save home location for a user
router.post('/sync/homeLocation', protect, async (req, res) => {
  try {
    const { homeLocation } = req.body;
    const userId = req.user.id;
    
    // Update user with home location
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { homeLocation: homeLocation } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Home location synced successfully'
    });
  } catch (error) {
    console.error('Error syncing home location:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync home location',
      error: error.message
    });
  }
});

// Sync user profile data
router.post('/sync/profile', protect, async (req, res) => {
  try {
    const { profile } = req.body;
    const userId = req.user.id;
    
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: 'Profile data must be provided'
      });
    }
    
    // Extract profile fields
    const {
      name,
      phone,
      address,
      age,
      medicalInfo,
      profileImageUrl
    } = profile;
    
    // Create update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (age !== undefined) updateData.age = age;
    if (medicalInfo) updateData.medicalInfo = medicalInfo;
    if (profileImageUrl) updateData.profileImage = profileImageUrl;
    
    // Update the user profile
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile data synced successfully'
    });
  } catch (error) {
    console.error('Error syncing profile data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync profile data',
      error: error.message
    });
  }
});

// ===== USER LOOKUP BY EMAIL =====

// Get user profile by email (used by caregivers to get accurate patient names)
router.get('/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }
    
    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Looking up user profile by email: ${normalizedEmail}`);
    
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.log(`User not found with email: ${normalizedEmail}`);
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }
    
    console.log(`User found: ${user.name} (${user.email})`);
    
    // Return a sanitized user object with only the needed fields
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      phone: user.phone || ''
    });
  } catch (error) {
    console.error('Error looking up user by email:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while looking up user profile'
    });
  }
});

// Lookup user info by email (combined endpoint for patient verification)
router.get('/lookup/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }
    
    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Looking up user by email: ${normalizedEmail}`);
    
    // Try to find user in the database
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.log(`User not found with email: ${normalizedEmail}`);
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }
    
    console.log(`User found: ${user.name}`);
    
    // Return minimal user info
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage
    });
  } catch (error) {
    console.error('Error looking up user by email:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
