// Enhanced Synchronization Service for MindFlow
// This module provides functions for handling profile data synchronization

const User = require('./models/user');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads/profile-images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory for profile images');
}

/**
 * Enhanced function to handle complete user data synchronization
 * This ensures that data is consistently maintained across all devices
 */
const fullUserDataSync = async (email, deviceId, userData = null) => {
  if (!email) {
    console.error('Email is required for full user data sync');
    return { success: false, message: 'Email is required' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Processing full data sync for ${normalizedEmail} from device ${deviceId}`);
    
    // Find the user
    let user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.error(`User not found for email: ${normalizedEmail}`);
      return { success: false, message: 'User not found' };
    }
    
    // If userData is provided, update the user's data
    if (userData) {
      console.log(`Received data update from device: ${deviceId}`);
      
      // Check if this device has the latest data version
      const clientDataVersion = userData.dataVersion || 0;
      
      // Server has newer data and no updates provided
      if (user.dataVersion > clientDataVersion && !userData.forceUpdate) {
        console.log(`Server has newer data (server: ${user.dataVersion}, client: ${clientDataVersion}). Sending server data.`);
        
        // Update the sync metadata
        user.lastSyncTime = new Date();
        user.lastSyncDeviceId = deviceId;
        await user.save();
        
        // Return the server's data
        return {
          success: true,
          message: 'Server has newer data',
          user: formatUserResponse(user),
          syncMetadata: {
            dataVersion: user.dataVersion,
            lastSyncTime: user.lastSyncTime,
            serverHasNewer: true
          }
        };
      }
      
      // Client has newer data or force update requested
      console.log(`Updating user data from device ${deviceId}`);
      
      // Update all the user fields with the provided data
      if (userData.name) user.name = userData.name;
      if (userData.phone) user.phone = userData.phone;
      if (userData.address) user.address = userData.address;
      if (userData.age) user.age = userData.age;
      if (userData.profileImage) user.profileImage = userData.profileImage;
      
      // Update medical info if provided
      if (userData.medicalInfo) {
        user.medicalInfo = {
          conditions: userData.medicalInfo.conditions || user.medicalInfo?.conditions || '',
          medications: userData.medicalInfo.medications || user.medicalInfo?.medications || '',
          allergies: userData.medicalInfo.allergies || user.medicalInfo?.allergies || '',
          bloodType: userData.medicalInfo.bloodType || user.medicalInfo?.bloodType || ''
        };
      }
      
      // Update home location if provided
      if (userData.homeLocation) {
        user.homeLocation = userData.homeLocation;
      }
      
      // Update sync metadata
      user.lastSyncTime = new Date();
      user.lastUpdatedBy = deviceId;
      user.lastSyncDeviceId = deviceId;
      user.dataVersion = (user.dataVersion || 0) + 1;
      user.forceSyncFlag = true; // Set flag to notify other devices
      
      await user.save();
      
      console.log(`User data updated successfully, new version: ${user.dataVersion}`);
    } else {
      // Just update sync metadata
      user.lastSyncTime = new Date();
      user.lastSyncDeviceId = deviceId;
      await user.save();
    }
    
    // Return the updated user data
    return {
      success: true,
      message: userData ? 'User data updated' : 'User data retrieved',
      user: formatUserResponse(user),
      syncMetadata: {
        dataVersion: user.dataVersion,
        lastSyncTime: user.lastSyncTime,
        serverHasNewer: false
      }
    };
  } catch (error) {
    console.error('Error in fullUserDataSync:', error);
    return { 
      success: false, 
      message: error.message || 'Unknown error during user data sync'
    };
  }
};

/**
 * Format user response to ensure consistent data structure
 */
const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    age: user.age || '',
    profileImage: user.profileImage || null,
    medicalInfo: {
      conditions: user.medicalInfo?.conditions || '',
      medications: user.medicalInfo?.medications || '',
      allergies: user.medicalInfo?.allergies || '',
      bloodType: user.medicalInfo?.bloodType || ''
    },
    homeLocation: user.homeLocation || null,
    dataVersion: user.dataVersion || 1,
    updatedAt: user.updatedAt || new Date().toISOString()
  };
};

// Original function to handle profile data synchronization
const syncUserProfile = async (email, deviceId, profileData) => {
  if (!email) {
    console.error('Email is required for profile sync');
    return { success: false, message: 'Email is required' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Processing profile sync for ${normalizedEmail} from device ${deviceId}`);
    
    // Find the user
    let user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.error(`User not found for email: ${normalizedEmail}`);
      return { success: false, message: 'User not found' };
    }
    
    // Handle conflict resolution for profile data
    let changes = {
      nameChanged: false,
      profileImageChanged: false
    };
    
    if (profileData) {
      // Name update logic - use timestamp to determine which is newer
      if (profileData.name && (!user.lastNameUpdate || 
          (profileData.lastNameUpdate && new Date(profileData.lastNameUpdate) > new Date(user.lastNameUpdate)))) {
        console.log(`Updating name from "${user.name}" to "${profileData.name}"`);
        user.name = profileData.name;
        user.lastNameUpdate = profileData.lastNameUpdate || new Date();
        changes.nameChanged = true;
      }
      
      // Profile image update logic - use timestamp to determine which is newer
      if (profileData.profileImage && (!user.lastProfileImageUpdate || 
          (profileData.lastProfileImageUpdate && new Date(profileData.lastProfileImageUpdate) > new Date(user.lastProfileImageUpdate)))) {
        console.log(`Updating profile image`);
        user.profileImage = profileData.profileImage;
        user.lastProfileImageUpdate = profileData.lastProfileImageUpdate || new Date();
        changes.profileImageChanged = true;
      }
    }
    
    // Update sync metadata
    user.lastSyncTime = new Date();
    user.lastSyncDeviceId = deviceId;
    
    // Save the updated user
    await user.save();
    
    return {
      success: true,
      changes,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        lastNameUpdate: user.lastNameUpdate,
        lastProfileImageUpdate: user.lastProfileImageUpdate
      }
    };
  } catch (error) {
    console.error('Error in syncUserProfile:', error);
    return { success: false, message: error.message || 'Unknown error during profile sync' };
  }
};

// Function to handle profile image uploads
const processProfileImage = async (imageFile, email, deviceId) => {
  if (!imageFile || !email) {
    return { success: false, message: 'Image file and email are required' };
  }
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Create the image URL based on file path
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const imageUrl = `${baseUrl}/uploads/profile-images/${imageFile.filename}`;
    
    // Update the user's profile image
    user.profileImage = imageUrl;
    user.lastProfileImageUpdate = new Date();
    user.lastUpdatedBy = deviceId;
    
    await user.save();
    
    return {
      success: true,
      imageUrl,
      message: 'Profile image updated successfully'
    };
  } catch (error) {
    console.error('Error processing profile image:', error);
    return { success: false, message: error.message || 'Error processing profile image' };
  }
};

// Function to notify other devices about profile updates
const notifyProfileUpdate = async (email, deviceId) => {
  if (!email) {
    return { success: false, message: 'Email is required' };
  }
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Update sync metadata to trigger sync on other devices
    user.lastSyncTime = new Date();
    user.lastUpdatedBy = deviceId || 'server';
    user.forceSyncFlag = true;
    
    await user.save();
    
    // Here you would typically implement push notifications to other devices
    // using Firebase Cloud Messaging or similar service
    
    return {
      success: true,
      message: 'Profile update notification sent'
    };
  } catch (error) {
    console.error('Error in notifyProfileUpdate:', error);
    return { success: false, message: error.message || 'Error notifying profile update' };
  }
};

// Function to force synchronization across all devices
const forceProfileSync = async (email) => {
  if (!email) {
    return { success: false, message: 'Email is required' };
  }
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Update sync metadata to force sync on all devices
    user.lastSyncTime = new Date();
    user.forceSyncFlag = true;
    
    await user.save();
    
    return {
      success: true,
      message: 'Force sync triggered',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    };
  } catch (error) {
    console.error('Error in forceProfileSync:', error);
    return { success: false, message: error.message || 'Error forcing profile sync' };
  }
};

// Function to check if a user needs to sync
const checkUserNeedsSync = async (email, deviceId, lastSyncTime) => {
  if (!email) {
    return { needsSync: false, message: 'Email is required' };
  }
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return { needsSync: false, message: 'User not found' };
    }
    
    // Convert lastSyncTime to Date object if it's a string
    const clientLastSync = lastSyncTime ? new Date(lastSyncTime) : new Date(0);
    
    // Check if server has newer data
    const serverLastSync = user.lastSyncTime || user.updatedAt || new Date(0);
    
    // Conditions for needing sync:
    // 1. Server has newer data
    // 2. The data was last updated by a different device
    // 3. Force sync flag is set
    const needsSync = serverLastSync > clientLastSync || 
                     (user.lastUpdatedBy && user.lastUpdatedBy !== deviceId) ||
                     user.forceSyncFlag === true;
    
    return {
      needsSync,
      reason: needsSync 
        ? (serverLastSync > clientLastSync 
            ? 'Server has newer data' 
            : (user.forceSyncFlag 
                ? 'Force sync requested' 
                : 'Updated by another device'))
        : 'No sync needed'
    };
  } catch (error) {
    console.error('Error in checkUserNeedsSync:', error);
    return { needsSync: false, message: error.message || 'Error checking sync status' };
  }
};

module.exports = {
  syncUserProfile,
  processProfileImage,
  notifyProfileUpdate,
  forceProfileSync,
  checkUserNeedsSync,
  fullUserDataSync
};
