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

// SYNC ENDPOINTS - SERVER-BASED STORAGE

// New unified sync endpoint that handles all user data with conflict resolution
router.post('/sync', protect, async (req, res) => {
  try {
    const { clientData, lastSyncTime } = req.body;
    const userEmail = req.user.email.toLowerCase();
    
    console.log(`Processing sync request for ${userEmail}, last sync: ${lastSyncTime}`);
    
    // Security check - only allow users to sync their own data
    if (userEmail !== clientData.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to sync this data'
      });
    }

    // Fetch current server data
    const serverUser = await User.findOne({ email: userEmail });
    
    if (!serverUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found on server'
      });
    }
    
    // Convert server data to a standard format
    const serverData = {
      id: serverUser._id,
      name: serverUser.name,
      email: serverUser.email,
      profileImage: serverUser.profileImage,
      phone: serverUser.phone || '',
      address: serverUser.address || '',
      age: serverUser.age || '',
      medicalInfo: serverUser.medicalInfo || {
        conditions: '',
        medications: '',
        allergies: '',
        bloodType: ''
      },
      homeLocation: serverUser.homeLocation,
      reminders: serverUser.reminders || [],
      memories: serverUser.memories || [],
      emergencyContacts: serverUser.emergencyContacts || [],
      caregiverEmail: serverUser.caregiverEmail || null,
      lastSyncTime: serverUser.lastSyncTime || new Date()
    };
    
    // Check sync timestamps to detect conflicts
    const clientSyncDate = new Date(lastSyncTime);
    const serverSyncDate = new Date(serverUser.lastSyncTime);
    
    // Merge data with conflict resolution
    const mergedData = mergeUserData(clientData, serverData, clientSyncDate, serverSyncDate);
    
    // Update the server with merged data
    const updatedUser = await User.findOneAndUpdate(
      { email: userEmail },
      { 
        ...mergedData,
        lastSyncTime: new Date() // Update sync timestamp
      },
      { new: true, runValidators: true }
    );
    
    console.log(`Sync completed for ${userEmail}`);
    
    // Return the merged data to ensure client and server are in sync
    res.json({
      success: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profileImage: updatedUser.profileImage,
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        age: updatedUser.age || '',
        medicalInfo: updatedUser.medicalInfo || {
          conditions: '',
          medications: '',
          allergies: '',
          bloodType: ''
        },
        homeLocation: updatedUser.homeLocation,
        reminders: updatedUser.reminders || [],
        memories: updatedUser.memories || [],
        emergencyContacts: updatedUser.emergencyContacts || [],
        caregiverEmail: updatedUser.caregiverEmail || null,
        lastSyncTime: updatedUser.lastSyncTime
      },
      conflicts: mergedData.conflicts || []
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync user data',
      error: error.message
    });
  }
});

// Helper function for data merging with conflict resolution
function mergeUserData(clientData, serverData, clientSyncDate, serverSyncDate) {
  // Start with the base user data from most recent source
  let mergedData;
  const conflicts = [];
  
  // Determine which source is newer for basic profile data
  if (clientSyncDate > serverSyncDate) {
    console.log('Client data is newer, using as base');
    mergedData = { ...clientData };
  } else {
    console.log('Server data is newer, using as base');
    mergedData = { ...serverData };
  }
  
  // Special handling for arrays that need merging (reminders, memories, contacts)
  
  // 1. Merge reminders
  mergedData.reminders = mergeArrayItems(
    clientData.reminders || [], 
    serverData.reminders || [],
    'id',
    (item) => conflicts.push({
      type: 'reminder',
      item,
      resolution: 'kept both versions'
    })
  );
  
  // 2. Merge memories
  mergedData.memories = mergeArrayItems(
    clientData.memories || [], 
    serverData.memories || [],
    'id',
    (item) => conflicts.push({
      type: 'memory',
      item,
      resolution: 'kept both versions'
    })
  );
  
  // 3. Merge emergency contacts
  mergedData.emergencyContacts = mergeArrayItems(
    clientData.emergencyContacts || [], 
    serverData.emergencyContacts || [],
    'id',
    (item) => conflicts.push({
      type: 'contact',
      item,
      resolution: 'kept both versions'
    })
  );
  
  // Handle profile image separately - prefer client image if available
  if (clientData.profileImage && (!serverData.profileImage || clientData.profileImage !== serverData.profileImage)) {
    mergedData.profileImage = clientData.profileImage;
  }
  
  mergedData.conflicts = conflicts;
  return mergedData;
}

// Helper function to merge array items with conflict detection
function mergeArrayItems(clientItems, serverItems, idField, conflictCallback) {
  const mergedItems = [...serverItems];
  const serverItemIds = new Set(serverItems.map(item => item[idField]));
  
  // Add items from client that don't exist on server
  clientItems.forEach(clientItem => {
    if (!serverItemIds.has(clientItem[idField])) {
      mergedItems.push(clientItem);
    } else {
      // Item exists in both - find and compare
      const serverItem = serverItems.find(item => item[idField] === clientItem[idField]);
      
      // If items are different, handle conflict
      if (JSON.stringify(clientItem) !== JSON.stringify(serverItem)) {
        // For now, keep both versions and report conflict
        mergedItems.push({
          ...clientItem,
          [idField]: `${clientItem[idField]}_conflict_${Date.now()}`
        });
        conflictCallback(clientItem);
      }
    }
  });
  
  return mergedItems;
}

// New comprehensive endpoint for full user data retrieval by email
router.get('/profile/byEmail/:email', protect, async (req, res) => {
  try {
    const { email } = req.params;
    // Normalize email before searching
    const normalizedEmail = email.toLowerCase().trim();
    
    // Security check - only allow users to access their own data or if they're a caregiver
    if (req.user.email.toLowerCase() !== normalizedEmail && 
        req.user.role !== 'caregiver' && 
        !req.user.patientEmail) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this data'
      });
    }
    
    console.log(`Retrieving profile data for email: ${normalizedEmail}`);
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false, 
        message: 'User not found'
      });
    }
    
    // Format the complete user profile data
    const userData = {
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
      caregiverEmail: user.caregiverEmail || null,
      lastSyncTime: user.lastSyncTime || new Date()
    };
    
    res.json({
      success: true,
      profile: userData,
      source: 'database'
    });
  } catch (error) {
    console.error('Get user profile by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile data',
      error: error.message
    });
  }
});

// Get user data by email (for cross-device access)
router.get('/sync/email/:email', protect, async (req, res) => {
  try {
    const { email } = req.params;
    // Normalize email before searching
    const normalizedEmail = email.toLowerCase().trim();
    
    // Only allow users to access their own data or caregivers with appropriate connection
    if (req.user.email.toLowerCase() !== normalizedEmail && !req.user.patientEmail) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this data'
      });
    }
    
    const user = await User.findOne({ email: normalizedEmail });
    
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
        },
        homeLocation: user.homeLocation,
        reminders: user.reminders || [],
        memories: user.memories || [],
        emergencyContacts: user.emergencyContacts || [],
        caregiverEmail: user.caregiverEmail || null
      }
    });
  } catch (error) {
    console.error('Get user by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data'
    });
  }
});

// Sync reminders endpoint
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
    
    res.json({
      success: true,
      reminders: user.reminders || []
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reminders'
    });
  }
});

// Update reminders endpoint
router.post('/sync/reminders', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reminders } = req.body;
    
    if (!Array.isArray(reminders)) {
      return res.status(400).json({
        success: false,
        message: 'Reminders must be an array'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { reminders, lastSyncTime: Date.now() },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      reminders: user.reminders
    });
  } catch (error) {
    console.error('Update reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reminders'
    });
  }
});

// Sync memories endpoint
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
    
    res.json({
      success: true,
      memories: user.memories || []
    });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get memories'
    });
  }
});

// Update memories endpoint
router.post('/sync/memories', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { memories } = req.body;
    
    if (!Array.isArray(memories)) {
      return res.status(400).json({
        success: false,
        message: 'Memories must be an array'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { memories, lastSyncTime: Date.now() },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      memories: user.memories
    });
  } catch (error) {
    console.error('Update memories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update memories'
    });
  }
});

// Sync emergency contacts endpoint
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
    
    res.json({
      success: true,
      contacts: user.emergencyContacts || []
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get emergency contacts'
    });
  }
});

// Update emergency contacts endpoint
router.post('/sync/contacts', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contacts } = req.body;
    
    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: 'Contacts must be an array'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { emergencyContacts: contacts, lastSyncTime: Date.now() },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      contacts: user.emergencyContacts
    });
  } catch (error) {
    console.error('Update contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update emergency contacts'
    });
  }
});

// Sync home location endpoint
router.post('/sync/homeLocation', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeLocation } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { homeLocation, lastSyncTime: Date.now() },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      homeLocation: user.homeLocation
    });
  } catch (error) {
    console.error('Update home location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update home location'
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

// Connect caregiver to patient
router.post('/connect/caregiver', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { caregiverEmail } = req.body;
    
    if (!caregiverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Caregiver email is required'
      });
    }
    
    // Find the user (patient)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find the caregiver by email
    const caregiver = await require('../models/Caregiver').findOne({ email: caregiverEmail.toLowerCase() });
    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found'
      });
    }
    
    // Update patient with caregiver email
    user.caregiverEmail = caregiverEmail.toLowerCase();
    await user.save();
    
    // Update caregiver with patient connection
    if (!caregiver.connectedPatients.includes(user.email)) {
      caregiver.connectedPatients.push(user.email);
    }
    
    if (!caregiver.patientEmail || caregiver.patientEmail === null) {
      caregiver.patientEmail = user.email; // Set as primary patient if none exists
    }
    
    // Initialize patient data in the caregiver's patientData map if it doesn't exist
    if (!caregiver.patientData.has(user.email)) {
      caregiver.patientData.set(user.email, {
        reminders: [],
        memories: [],
        emergencyContacts: [],
        homeLocation: null,
        lastSync: new Date()
      });
    }
    
    await caregiver.save();
    
    return res.status(200).json({
      success: true,
      message: 'Connected patient with caregiver successfully'
    });
    
  } catch (error) {
    console.error('Error connecting caregiver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect caregiver',
      error: error.message
    });
  }
});

// Get patient data for caregiver
router.get('/patient/:patientEmail', protect, async (req, res) => {
  try {
    const caregiverId = req.user.id;
    const { patientEmail } = req.params;
    
    // Find the caregiver
    const caregiver = await require('../models/Caregiver').findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found'
      });
    }
    
    // Check if caregiver is connected to this patient
    if (!caregiver.connectedPatients.includes(patientEmail.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this patient data'
      });
    }
    
    // Find the patient
    const patient = await User.findOne({ email: patientEmail.toLowerCase() });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Return patient data
    return res.status(200).json({
      success: true,
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        profileImage: patient.profileImage,
        phone: patient.phone || '',
        address: patient.address || '',
        age: patient.age || '',
        medicalInfo: patient.medicalInfo || {
          conditions: '',
          medications: '',
          allergies: '',
          bloodType: ''
        },
        homeLocation: patient.homeLocation,
        reminders: patient.reminders || [],
        memories: patient.memories || [],
        emergencyContacts: patient.emergencyContacts || []
      }
    });
    
  } catch (error) {
    console.error('Error getting patient data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get patient data',
      error: error.message
    });
  }
});

module.exports = router;
