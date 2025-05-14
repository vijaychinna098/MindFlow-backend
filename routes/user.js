// user.js (User update route)
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const protect = require('../middlewares/protect'); // Adjust the path as necessary

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

module.exports = router;
