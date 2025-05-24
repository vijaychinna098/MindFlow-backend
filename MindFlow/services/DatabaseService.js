// DatabaseService.js - Centralized service for database operations
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Get device ID for tracking sync sources
const getDeviceId = async () => {
  try {
    const deviceId = await AsyncStorage.getItem('deviceId');
    if (deviceId) return deviceId;
    
    // Generate a new device ID
    const newDeviceId = `${Platform.OS}_${Device.modelName || 'unknown'}_${Date.now()}`;
    await AsyncStorage.setItem('deviceId', newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return `unknown_${Date.now()}`;
  }
};

// Helper to get auth token for API requests
const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Helper to set auth headers for API requests
const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Device-ID': await getDeviceId()
  };
};

/**
 * Retrieve user profile directly from database by email
 */
export const fetchUserProfileFromDB = async (email) => {
  try {
    if (!email) {
      console.error('Email is required');
      return { success: false, error: 'Email is required' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Fetching profile from database for: ${normalizedEmail}`);

    // Try multiple API endpoints in case some are unavailable
    const endpoints = [
      `/api/user/profile/byEmail/${normalizedEmail}`,
      `/api/users/profile/${normalizedEmail}`,
      `/api/user/${normalizedEmail}/profile`,
      `/api/profile/${normalizedEmail}`
    ];

    let response = null;
    let errorMessage = '';

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${API_BASE_URL}${endpoint}`);
        response = await axios.get(
          `${API_BASE_URL}${endpoint}`,
          { 
            headers: await getAuthHeaders(),
            timeout: 10000 // 10 second timeout for better reliability
          }
        );

        if (response.data && (response.data.success || response.data.profile || response.data.user)) {
          break;  // We got a successful response, exit the loop
        }
      } catch (endpointError) {
        errorMessage = `${endpointError.message} (${endpoint})`;
        console.log(`Failed endpoint ${endpoint}: ${endpointError.message}`);
        // Continue with next endpoint
      }
    }

    // If we got a successful response from any endpoint
    if (response && response.data) {
      if (response.data.success || response.data.profile || response.data.user) {
        console.log(`Profile successfully retrieved from database for: ${normalizedEmail}`);
        
        // Extract the profile from wherever it was returned
        const profile = response.data.profile || response.data.user || response.data.data;
        
        // Cache a copy locally as backup
        await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(profile));
        
        return {
          success: true,
          profile: profile,
          source: 'database'
        };
      }
    }
    
    console.log(`Profile not found in database for: ${normalizedEmail}, error: ${errorMessage}`);
    
    // Try to use cached data as fallback
    try {
      const cachedData = await AsyncStorage.getItem(`userData_${email.toLowerCase().trim()}`);
      if (cachedData) {
        console.log(`Using cached data as fallback for: ${email}`);
        return {
          success: true,
          profile: JSON.parse(cachedData),
          source: 'cache'
        };
      }
    } catch (cacheError) {
      console.log(`Cache error: ${cacheError.message}`);
    }
    
    return { 
      success: false, 
      error: errorMessage || 'Profile not found' 
    };
  } catch (error) {
    console.error(`Error fetching profile from database: ${error.message}`);
    
    // Try to use cached data as fallback
    try {
      const cachedData = await AsyncStorage.getItem(`userData_${email.toLowerCase().trim()}`);
      if (cachedData) {
        console.log(`Using cached data as fallback for: ${email}`);
        return {
          success: true,
          profile: JSON.parse(cachedData),
          source: 'cache'
        };
      }
    } catch (cacheError) {
      console.log(`Cache error: ${cacheError.message}`);
    }
    
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
};

/**
 * Save user profile directly to database
 */
export const saveUserProfileToDB = async (userData) => {
  try {
    if (!userData || !userData.email) {
      console.error('Invalid user data');
      return { success: false, error: 'Invalid user data' };
    }

    const normalizedEmail = userData.email.toLowerCase().trim();
    console.log(`Saving profile to database for: ${normalizedEmail}`);

    // Check if we're uploading a profile image
    if (userData.profileImage) {
      console.log(`Profile contains image: ${userData.profileImage.substring(0, 30)}...`);
    }

    // Update timestamp
    const updatedUserData = {
      ...userData,
      lastSyncTime: new Date().toISOString(),
      deviceId: await getDeviceId() // Add device ID for better tracking
    };

    // Try multiple endpoints for better reliability
    const endpoints = [
      // Updated to use the most reliable endpoints first
      { method: 'post', path: `/api/user/sync` },       // Primary endpoint (our new robust sync endpoint)
      { method: 'post', path: `/user/sync` },           // Alternate path without /api prefix
      { method: 'post', path: `/api/users/update` },    // Legacy endpoint
      { method: 'put', path: `/api/users/profile` },    // Legacy endpoint
      { method: 'post', path: `/api/sync/profile` }     // Backup endpoint
    ];

    let response = null;
    let errorMessage = '';

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying ${endpoint.method.toUpperCase()} endpoint: ${API_BASE_URL}${endpoint.path}`);
        
        if (endpoint.method === 'put') {
          response = await axios.put(
            `${API_BASE_URL}${endpoint.path}`, 
            updatedUserData,
            { 
              headers: await getAuthHeaders(),
              timeout: 15000 // Increase timeout for larger payloads with images
            }
          );
        } else {
          response = await axios.post(
            `${API_BASE_URL}${endpoint.path}`, 
            updatedUserData,
            { 
              headers: await getAuthHeaders(),
              timeout: 15000 // Increase timeout for larger payloads with images
            }
          );
        }

        if (response.data && (response.data.success || response.data.profile || response.data.user)) {
          console.log(`Profile successfully saved using ${endpoint.path}`);
          break;  // We got a successful response, exit the loop
        }
      } catch (endpointError) {
        errorMessage = `${endpointError.message} (${endpoint.path})`;
        console.log(`Failed endpoint ${endpoint.path}: ${endpointError.message}`);
        // Continue with next endpoint
      }
    }

    // If any endpoint succeeded
    if (response && response.data && (response.data.success || response.data.profile || response.data.user)) {
      console.log(`Profile successfully saved to database for: ${normalizedEmail}`);
      
      // Extract the returned profile data
      const returnedProfile = response.data.user || response.data.profile || response.data.data || response.data;
      
      // Preserve critical data that might be missing from server response
      const preservedProfile = {
        ...returnedProfile,
        // Ensure we don't lose the profile image during sync
        profileImage: returnedProfile.profileImage || userData.profileImage,
        // Ensure we preserve medical info
        medicalInfo: {
          ...(userData.medicalInfo || {}),
          ...(returnedProfile.medicalInfo || {})
        },
        // Preserve other critical fields
        homeLocation: returnedProfile.homeLocation || userData.homeLocation,
        phone: returnedProfile.phone || userData.phone,
        age: returnedProfile.age || userData.age,
        address: returnedProfile.address || userData.address,
        // Ensure caregiver information is preserved
        caregiverName: returnedProfile.caregiverName || userData.caregiverName,
        caregiverPhone: returnedProfile.caregiverPhone || userData.caregiverPhone,
        caregiverEmail: returnedProfile.caregiverEmail || userData.caregiverEmail
      };
      
      // Additional logging for profile image diagnosis
      if (userData.profileImage && !preservedProfile.profileImage) {
        console.warn('Profile image was lost during server sync! Restoring from local data');
        preservedProfile.profileImage = userData.profileImage;
      }
      
      // Cache a copy locally as backup
      await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(preservedProfile));
      
      // If this profile has a caregiver name, cache it separately for faster access
      if (preservedProfile.caregiverName) {
        try {
          await AsyncStorage.setItem(`caregiverName_${normalizedEmail}`, preservedProfile.caregiverName);
          console.log(`Cached caregiver name "${preservedProfile.caregiverName}" for ${normalizedEmail}`);
        } catch (cacheError) {
          console.log(`Failed to cache caregiver name: ${cacheError.message}`);
        }
      }
      
      // Notify the server that a change has been made to trigger push updates to other devices
      try {
        await notifyProfileChange(normalizedEmail);
      } catch (notifyError) {
        console.log(`Failed to notify of profile change: ${notifyError.message}`);
      }
      
      return {
        success: true,
        profile: preservedProfile,
        source: 'database'
      };
    }

    // If all endpoints failed, cache locally for later sync
    console.log(`Failed to save profile to database: ${errorMessage}`);
    
    try {
      await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userData));
      console.log(`Cached data locally as backup for: ${userData.email}`);
      
      // Track as pending sync
      const pendingSyncsKey = 'pendingProfileSyncs';
      const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
      const pendingSyncs = JSON.parse(pendingSyncsStr);
      
      // Add to pending syncs if not already there
      const existingIndex = pendingSyncs.findIndex(sync => 
        sync.email === normalizedEmail);
      
      if (existingIndex >= 0) {
        // Update existing entry with more recent data
        pendingSyncs[existingIndex] = {
          email: normalizedEmail,
          profileData: userData,
          updatedAt: new Date().toISOString()
        };
      } else {
        pendingSyncs.push({
          email: normalizedEmail,
          profileData: userData,
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
      
      // Cache caregiver name separately for faster access
      if (userData.caregiverName) {
        try {
          await AsyncStorage.setItem(`caregiverName_${normalizedEmail}`, userData.caregiverName);
          console.log(`Cached caregiver name "${userData.caregiverName}" for ${normalizedEmail}`);
        } catch (cacheError) {
          console.log(`Failed to cache caregiver name: ${cacheError.message}`);
        }
      }
    } catch (cacheError) {
      console.log(`Cache error: ${cacheError.message}`);
    }
    
    return { 
      success: false, 
      error: errorMessage || 'Failed to save profile',
      cached: true
    };
  } catch (error) {
    console.error(`Error saving profile to database: ${error.message}`);
    
    // Cache locally for later sync
    try {
      await AsyncStorage.setItem(`userData_${userData.email.toLowerCase().trim()}`, JSON.stringify(userData));
      console.log(`Cached data locally as backup for: ${userData.email}`);
      
      // Track as pending sync
      const pendingSyncsKey = 'pendingProfileSyncs';
      const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
      const pendingSyncs = JSON.parse(pendingSyncsStr);
      
      // Add to pending syncs if not already there
      const existingIndex = pendingSyncs.findIndex(sync => 
        sync.email === userData.email.toLowerCase().trim());
      
      if (existingIndex >= 0) {
        pendingSyncs[existingIndex] = {
          email: userData.email.toLowerCase().trim(),
          profileData: userData,
          updatedAt: new Date().toISOString()
        };
      } else {
        pendingSyncs.push({
          email: userData.email.toLowerCase().trim(),
          profileData: userData,
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
    } catch (cacheError) {
      console.log(`Cache error: ${cacheError.message}`);
    }
    
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      cached: true
    };
  }
};

/**
 * Login user and retrieve profile
 */
export const loginWithDatabase = async (credentials) => {
  try {
    console.log(`Logging in with email: ${credentials.email}`);
    
    // Send login request to multiple possible endpoints
    const endpoints = [
      `/api/auth/login`,
      `/api/users/login`,
      `/api/login`
    ];

    let response = null;
    let errorMessage = '';

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying login endpoint: ${API_BASE_URL}${endpoint}`);
        response = await axios.post(
          `${API_BASE_URL}${endpoint}`, 
          credentials,
          { timeout: 10000 }
        );

        if (response.data && (response.data.success || response.data.token)) {
          break;  // We got a successful response, exit the loop
        }
      } catch (endpointError) {
        errorMessage = `${endpointError.message} (${endpoint})`;
        console.log(`Failed login endpoint ${endpoint}: ${endpointError.message}`);
        // Continue with next endpoint
      }
    }
    
    if (response && response.data && (response.data.success || response.data.token)) {
      console.log('Login successful');
      const { token, user } = response.data;
      
      // Store auth token for future requests
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('currentUserEmail', user.email.toLowerCase().trim());
      
      // Cache user data locally as backup
      await AsyncStorage.setItem(`userData_${user.email.toLowerCase().trim()}`, JSON.stringify(user));
      
      return {
        success: true,
        user,
        token
      };
    } else {
      console.log('Login failed:', errorMessage);
      return { 
        success: false, 
        error: errorMessage || 'Login failed'
      };
    }
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Specifically fetch profile image and caregiver name by email
 * Used to ensure consistent data across devices
 */
export const fetchProfileImageByEmail = async (email) => {
  try {
    if (!email) {
      console.error('Email is required to fetch profile image');
      return { success: false, error: 'Email is required' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Specifically fetching profile image for: ${normalizedEmail}`);

    // Try multiple API endpoints for better reliability
    const endpoints = [
      `/api/user/profile/image/${normalizedEmail}`,
      `/api/users/profile/image/${normalizedEmail}`,
      `/api/profile/image/${normalizedEmail}`,
      `/api/user/profile/byEmail/${normalizedEmail}`
    ];

    let response = null;
    let profileImage = null;
    let caregiverName = null;
    let errorMessage = '';

    // Try each endpoint to get the profile image
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying image endpoint: ${API_BASE_URL}${endpoint}`);
        response = await axios.get(
          `${API_BASE_URL}${endpoint}`,
          { 
            headers: await getAuthHeaders(),
            timeout: 8000 // 8 second timeout
          }
        );

        // Check if we got a valid response with image data
        if (response.data) {
          if (response.data.profileImage) {
            console.log(`Found profile image at endpoint: ${endpoint}`);
            profileImage = response.data.profileImage;
          }
          
          if (response.data.caregiverName) {
            console.log(`Found caregiver name: ${response.data.caregiverName}`);
            caregiverName = response.data.caregiverName;
          }
          
          // If we have both, we can stop searching
          if (profileImage && caregiverName) {
            break;
          }
        }
      } catch (endpointError) {
        errorMessage = `${endpointError.message} (${endpoint})`;
        console.log(`Failed image endpoint ${endpoint}: ${endpointError.message}`);
        // Continue with next endpoint
      }
    }

    // If server fetch successful, update local storage
    if (profileImage || caregiverName) {
      try {
        // Get current user data to update
        const userData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
        if (userData) {
          const userDataObj = JSON.parse(userData);
          const updated = {
            ...userDataObj
          };
          
          // Update with new data if available
          if (profileImage) {
            updated.profileImage = profileImage;
            console.log(`Updated local storage with profile image for: ${normalizedEmail}`);
          }
          
          if (caregiverName) {
            updated.caregiverName = caregiverName;
            console.log(`Updated local storage with caregiver name: ${caregiverName}`);
            
            // Also store caregiver name separately
            await AsyncStorage.setItem(`caregiverName_${normalizedEmail}`, caregiverName);
          }
          
          // Save updated user data
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(updated));
        }
      } catch (storageError) {
        console.log(`Error updating local storage: ${storageError.message}`);
      }
      
      return {
        success: true,
        profileImage,
        caregiverName
      };
    }
    
    console.log(`Couldn't find profile image or caregiver name on server for: ${normalizedEmail}`);
    return { 
      success: false,
      error: errorMessage || 'Profile image not found'
    };
  } catch (error) {
    console.error(`Error fetching profile image: ${error.message}`);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Force direct profile image synchronization between devices
 * This is a more aggressive approach to ensure images transfer properly
 */
export const forceProfileImageSync = async (email) => {
  try {
    if (!email) {
      console.log('Email required for image sync');
      return { success: false };
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`FORCE IMAGE SYNC: Starting for ${normalizedEmail}`);
    
    // First check if we have a locally stored image
    const userDataKey = `userData_${normalizedEmail}`;
    const userData = await AsyncStorage.getItem(userDataKey);
    let localImage = null;
    
    if (userData) {
      const userObj = JSON.parse(userData);
      localImage = userObj.profileImage;
      console.log(`FORCE IMAGE SYNC: Local image ${localImage ? 'exists' : 'not found'}`);
    }
    
    // Get auth token for API calls
    const token = await AsyncStorage.getItem('authToken');
    
    // Try to upload our image to server if we have one locally
    if (localImage) {
      console.log(`FORCE IMAGE SYNC: Uploading local image to server`);
      
      try {
        // Try multiple endpoints for better reliability
        const uploadEndpoints = [
          '/api/user/profile/image',
          '/api/users/profile/upload-image',
          '/api/profile/image/upload'
        ];
        
        for (const endpoint of uploadEndpoints) {
          try {
            console.log(`FORCE IMAGE SYNC: Trying upload endpoint ${endpoint}`);
            const uploadResult = await axios.post(
              `${API_BASE_URL}${endpoint}`,
              { 
                email: normalizedEmail,
                profileImage: localImage 
              },
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                timeout: 15000
              }
            );
            
            if (uploadResult.data && uploadResult.data.success) {
              console.log(`FORCE IMAGE SYNC: Upload successful via ${endpoint}`);
              break;
            }
          } catch (uploadErr) {
            console.log(`FORCE IMAGE SYNC: Upload failed for ${endpoint}: ${uploadErr.message}`);
          }
        }
      } catch (uploadError) {
        console.log(`FORCE IMAGE SYNC: Upload error: ${uploadError.message}`);
      }
    }
    
    // Now try to download the image from the server
    console.log(`FORCE IMAGE SYNC: Downloading image from server`);
    
    // Try multiple endpoints to get the image
    const downloadEndpoints = [
      `/api/user/profile/${normalizedEmail}`,
      `/api/users/profile/${normalizedEmail}`, 
      `/api/profile/by-email/${normalizedEmail}`,
      `/api/user/profile/image/${normalizedEmail}`
    ];
    
    let serverImage = null;
    
    for (const endpoint of downloadEndpoints) {
      try {
        console.log(`FORCE IMAGE SYNC: Trying download endpoint ${endpoint}`);
        const downloadResult = await axios.get(
          `${API_BASE_URL}${endpoint}`,
          { 
            headers: { 
              'Authorization': `Bearer ${token}`
            },
            timeout: 10000
          }
        );
        
        if (downloadResult.data) {
          // Look for profile image in different possible response formats
          const profile = downloadResult.data.profile || downloadResult.data.user || downloadResult.data;
          
          if (profile && profile.profileImage) {
            serverImage = profile.profileImage;
            console.log(`FORCE IMAGE SYNC: Found image on server via ${endpoint}`);
            break;
          }
        }
      } catch (downloadErr) {
        console.log(`FORCE IMAGE SYNC: Download failed for ${endpoint}: ${downloadErr.message}`);
      }
    }
    
    // If we found a server image, update local storage
    if (serverImage) {
      console.log(`FORCE IMAGE SYNC: Updating local storage with server image`);
      
      try {
        // Get current user data
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          // Update with the server image
          const userObj = JSON.parse(userData);
          userObj.profileImage = serverImage;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
          
          // Also store the image separately for faster access
          await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, serverImage);
          
          console.log(`FORCE IMAGE SYNC: Successfully saved server image to local storage`);
          
          return { 
            success: true, 
            profileImage: serverImage,
            source: 'server'
          };
        }
      } catch (storageError) {
        console.log(`FORCE IMAGE SYNC: Storage error: ${storageError.message}`);
      }
    } else if (localImage) {
      // No server image but we have local image
      console.log(`FORCE IMAGE SYNC: No server image found, but using local image`);
      
      // Store the local image separately for faster access
      try {
        await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, localImage);
      } catch (storageErr) {
        console.log(`FORCE IMAGE SYNC: Error storing separate image: ${storageErr.message}`);
      }
      
      return {
        success: true,
        profileImage: localImage,
        source: 'local'
      };
    }
    
    return { 
      success: false,
      error: 'No profile image found on server or locally'
    };
  } catch (error) {
    console.error(`FORCE IMAGE SYNC: Error: ${error.message}`);
    return { 
      success: false, 
      error: error.message
    };
  }
};

/**
 * CLOUD DB: Store user profile directly in MongoDB Atlas
 * Ensures real-time sync between devices
 */
export const cloudStoreUserProfile = async (userData) => {
  try {
    if (!userData || !userData.email) {
      console.error('Email is required for cloud storage');
      return { success: false, error: 'Email required' };
    }

    const normalizedEmail = userData.email.toLowerCase().trim();
    console.log(`CLOUD DB: Storing profile in MongoDB for: ${normalizedEmail}`);
    
    // IMPORTANT: Always accept name changes and update canonical name
    if (userData.name) {
      console.log(`CLOUD DB: User has provided name "${userData.name}", updating canonical name`);
      try {
        // Always update the canonical name to match what the user provided
        await AsyncStorage.setItem(`canonicalName_${normalizedEmail}`, userData.name);
      } catch (nameError) {
        console.log(`CLOUD DB: Error updating canonical name: ${nameError.message}`);
      }
    } else {
      // Only if name is missing, check for canonical name
      try {
        const canonicalNameKey = `canonicalName_${normalizedEmail}`;
        const canonicalName = await AsyncStorage.getItem(canonicalNameKey);
        
        if (canonicalName) {
          console.log(`CLOUD DB: No name provided, using canonical name: "${canonicalName}"`);
          userData.name = canonicalName;
        }
      } catch (nameError) {
        console.log(`CLOUD DB: Error checking canonical name: ${nameError.message}`);
      }
    }
    
    // Always ensure profile image consistency
    try {
      const profileImageKey = `profileImage_${normalizedEmail}`;
      const storedImage = await AsyncStorage.getItem(profileImageKey);
      
      if (storedImage && !userData.profileImage) {
        console.log('CLOUD DB: Found separately stored profile image, adding to profile data');
        userData.profileImage = storedImage;
      }
    } catch (prepError) {
      console.log(`CLOUD DB: Error preparing profile data: ${prepError.message}`);
    }
    
    // Add device ID and timestamp
    const deviceId = await getDeviceId();
    const dataWithMeta = {
      ...userData,
      lastUpdatedBy: deviceId,
      lastUpdatedAt: new Date().toISOString()
    };

    // Try multiple endpoints to ensure database sync
    const endpoints = [
      '/api/user/store-mongodb',
      '/api/users/store-profile',
      '/api/profile/cloud-store'
    ];

    let successResponse = null;
    let retryCount = 0;
    const maxRetries = 2; // Retry up to 2 times for better success rate
    
    // Function for retrying failed endpoints
    const tryEndpoint = async (endpoint) => {
      try {
        console.log(`CLOUD DB: Trying endpoint ${endpoint}`);
        const response = await axios.post(
          `${API_BASE_URL}${endpoint}`,
          dataWithMeta,
          { headers: await getAuthHeaders(), timeout: 15000 }
        );

        if (response.data && response.data.success) {
          console.log(`CLOUD DB: Successfully stored in MongoDB via ${endpoint}`);
          return response;
        }
      } catch (endpointErr) {
        console.log(`CLOUD DB: Endpoint ${endpoint} failed: ${endpointErr.message}`);
      }
      return null;
    };
    
    // Try each endpoint with retries
    for (let i = 0; i <= maxRetries && !successResponse; i++) {
      if (i > 0) {
        console.log(`CLOUD DB: Retry attempt ${i} for profile storage`);
      }
      
      for (const endpoint of endpoints) {
        const response = await tryEndpoint(endpoint);
        if (response) {
          successResponse = response;
          break;
        }
      }
    }

    if (successResponse) {
      // Store minimal data locally for offline access
      try {
        const returnedProfile = successResponse.data.profile || dataWithMeta;
        
        // Ensure critical fields aren't lost
        const mergedProfile = {
          ...returnedProfile,
          profileImage: returnedProfile.profileImage || userData.profileImage,
          name: returnedProfile.name || userData.name
        };
        
        await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
          ...mergedProfile,
          _localCacheTime: new Date().toISOString()
        }));
        
        // Also store profile image separately for redundancy
        if (mergedProfile.profileImage) {
          await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, mergedProfile.profileImage);
        }
        
        // Store canonical name if it exists
        if (mergedProfile.name) {
          await AsyncStorage.setItem(`canonicalName_${normalizedEmail}`, mergedProfile.name);
        }
      } catch (cacheErr) {
        console.log(`CLOUD DB: Error caching minimal data: ${cacheErr.message}`);
      }
      
      return {
        success: true,
        profile: successResponse.data.profile || dataWithMeta
      };
    }

    console.log(`CLOUD DB: All MongoDB storage attempts failed, falling back to local save`);
    
    // Store locally even if server storage failed
    try {
      await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
        ...dataWithMeta,
        _localCacheTime: new Date().toISOString(),
        _pendingServerSync: true
      }));
      
      if (userData.profileImage) {
        await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, userData.profileImage);
      }
      
      // Add to pending syncs queue for later retry
      const pendingSyncsKey = 'pendingProfileSyncs';
      const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
      const pendingSyncs = JSON.parse(pendingSyncsStr);
      
      const existingIndex = pendingSyncs.findIndex(sync => 
        sync.email === normalizedEmail);
      
      if (existingIndex >= 0) {
        pendingSyncs[existingIndex] = {
          email: normalizedEmail,
          profileData: dataWithMeta,
          updatedAt: new Date().toISOString()
        };
      } else {
        pendingSyncs.push({
          email: normalizedEmail,
          profileData: dataWithMeta,
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
      
      return {
        success: true,
        profile: dataWithMeta,
        localOnly: true,
        message: 'Saved locally only, will sync when server is available'
      };
    } catch (localSaveError) {
      console.log(`CLOUD DB: Local save also failed: ${localSaveError.message}`);
    }
    
    return { 
      success: false, 
      error: 'All storage attempts failed',
      message: 'Could not save profile to server or locally'
    };
  } catch (error) {
    console.error(`CLOUD DB: Error storing user profile: ${error.message}`);
    
    try {
      // Still try to save locally in case of error
      const normalizedEmail = userData.email.toLowerCase().trim();
      await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
        ...userData,
        _localCacheTime: new Date().toISOString(),
        _pendingServerSync: true
      }));
      
      // Also save profile image separately if available
      if (userData.profileImage) {
        await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, userData.profileImage);
      }
      
      return {
        success: true,
        localOnly: true,
        message: 'Saved locally due to error, will sync later',
        error: error.message
      };
    } catch (localError) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * CLOUD DB: Retrieve user profile directly from MongoDB Atlas
 * Always gets latest data across all devices
 */
export const cloudGetUserProfile = async (email) => {
  try {
    if (!email) {
      console.error('Email is required for cloud retrieval');
      return { success: false, error: 'Email required' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`CLOUD DB: Fetching profile from MongoDB for: ${normalizedEmail}`);
    
    // Get device ID for tracking
    const deviceId = await getDeviceId();

    // Try multiple endpoints to ensure database fetch
    const endpoints = [
      `/api/user/get-mongodb/${normalizedEmail}`,
      `/api/users/get-profile/${normalizedEmail}`,
      `/api/profile/cloud-get/${normalizedEmail}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`CLOUD DB: Trying endpoint ${endpoint}`);
        const response = await axios.get(
          `${API_BASE_URL}${endpoint}`,
          { 
            headers: {
              ...await getAuthHeaders(),
              'X-Last-Fetch': new Date().toISOString(),
              'X-Device-ID': deviceId
            },
            timeout: 15000
          }
        );

        if (response.data && response.data.success && response.data.profile) {
          console.log(`CLOUD DB: Successfully retrieved from MongoDB via ${endpoint}`);
          
          // Store minimal data locally for offline access
          try {
            await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
              ...response.data.profile,
              _localCacheTime: new Date().toISOString()
            }));
            
            // Store profile image separately if available
            if (response.data.profile.profileImage) {
              await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, response.data.profile.profileImage);
            }
          } catch (cacheErr) {
            console.log(`CLOUD DB: Error caching profile data: ${cacheErr.message}`);
          }
          
          return {
            success: true,
            profile: response.data.profile
          };
        }
      } catch (endpointErr) {
        console.log(`CLOUD DB: Endpoint ${endpoint} failed: ${endpointErr.message}`);
      }
    }

    console.log(`CLOUD DB: All MongoDB fetch attempts failed`);
    
    // Try to use local cache as last resort
    try {
      const cachedData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        console.log(`CLOUD DB: Using cached data from ${parsed._localCacheTime || 'unknown time'}`);
        return {
          success: true,
          profile: parsed,
          fromCache: true
        };
      }
    } catch (cacheErr) {
      console.log(`CLOUD DB: Error reading cache: ${cacheErr.message}`);
    }
    
    return { success: false, error: 'All fetch attempts failed' };
  } catch (error) {
    console.error(`CLOUD DB: Error retrieving user profile: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * CLOUD DB: Real-time check for profile updates from other devices
 */
export const checkForRemoteUpdates = async (email) => {
  try {
    if (!email) return { success: false, error: 'Email required' };
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`CLOUD DB: Checking for remote updates for: ${normalizedEmail}`);
    
    // Get device ID and last update time
    const deviceId = await getDeviceId();
    let lastCheckTime = await AsyncStorage.getItem(`lastUpdateCheck_${normalizedEmail}`);
    if (!lastCheckTime) lastCheckTime = new Date(0).toISOString();
    
    // Add a cache busting parameter to prevent response caching
    const cacheBuster = Date.now();
    
    // Try multiple endpoints with cache busting
    const endpoints = [
      `/api/user/check-updates/${normalizedEmail}?cb=${cacheBuster}`,
      `/api/profile/updates/${normalizedEmail}?cb=${cacheBuster}`,
      `/api/sync/check/${normalizedEmail}?cb=${cacheBuster}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
          headers: {
            ...await getAuthHeaders(),
            'X-Last-Check': lastCheckTime,
            'X-Device-ID': deviceId,
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          },
          timeout: 5000 // Reduced timeout for faster responses
        });
        
        if (response.data && response.data.success) {
          // Update last check time
          await AsyncStorage.setItem(`lastUpdateCheck_${normalizedEmail}`, new Date().toISOString());
          
          // If remote data is newer than our data, return it
          if (response.data.hasUpdates && response.data.profile) {
            console.log(`CLOUD DB: New updates found from another device!`);
            
            // Immediately save the updated profile to local storage for offline access
            try {
              await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
                ...response.data.profile,
                _localCacheTime: new Date().toISOString()
              }));
              
              if (response.data.profile.profileImage) {
                await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, response.data.profile.profileImage);
              }
            } catch (cacheErr) {
              console.log(`CLOUD DB: Error caching updates: ${cacheErr.message}`);
            }
            
            return {
              success: true,
              hasUpdates: true,
              profile: response.data.profile
            };
          }
          
          // No updates needed
          return {
            success: true,
            hasUpdates: false
          };
        }
      } catch (endpointErr) {
        console.log(`CLOUD DB: Update check endpoint ${endpoint} failed: ${endpointErr.message}`);
      }
    }
    
    return { success: false, error: 'Failed to check for updates' };
  } catch (error) {
    console.error(`CLOUD DB: Error checking for updates: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Login user with MongoDB direct authentication
 */
export const loginWithMongoDB = async (credentials) => {
  try {
    console.log(`CLOUD DB: Authenticating with MongoDB for: ${credentials.email}`);
    
    // Send login request to multiple possible endpoints
    const endpoints = [
      `/api/auth/login-mongodb`,
      `/api/users/login-direct`,
      `/api/login-cloud`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`CLOUD DB: Trying login endpoint: ${API_BASE_URL}${endpoint}`);
        const response = await axios.post(
          `${API_BASE_URL}${endpoint}`, 
          {
            ...credentials,
            deviceId: await getDeviceId()
          },
          { timeout: 15000 }
        );

        if (response.data && (response.data.success || response.data.token)) {
          console.log('CLOUD DB: Login successful');
          const { token, user } = response.data;
          
          // Store auth token for future requests
          await AsyncStorage.setItem('authToken', token);
          await AsyncStorage.setItem('currentUserEmail', user.email.toLowerCase().trim());
          
          // Cache user data locally as backup
          await AsyncStorage.setItem(`userData_${user.email.toLowerCase().trim()}`, JSON.stringify({
            ...user,
            _localCacheTime: new Date().toISOString()
          }));
          
          return {
            success: true,
            user,
            token
          };
        }
      } catch (endpointError) {
        console.log(`CLOUD DB: Failed login endpoint ${endpoint}: ${endpointError.message}`);
      }
    }
    
    console.log('CLOUD DB: All login attempts failed');
    return { 
      success: false, 
      error: 'Login failed - could not authenticate with MongoDB'
    };
  } catch (error) {
    console.error(`CLOUD DB: Login error: ${error.message}`);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * CLOUD DB: Notify other devices about a profile change
 * This helps other devices sync faster instead of waiting for polling
 */
export const notifyProfileChange = async (email) => {
  try {
    if (!email) return { success: false, error: 'Email required' };
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`CLOUD DB: Notifying other devices about profile change for: ${normalizedEmail}`);
    
    const deviceId = await getDeviceId();
    
    // UPDATED: Use more reliable endpoints for notifications
    const endpoints = [
      '/api/users/notify',
      '/api/sync/notify',
      '/api/profile/notify',
      '/api/notifications/profile'
    ];
    
    // Include a cache-busting timestamp and enhanced payload
    const payload = {
      email: normalizedEmail,
      deviceId: deviceId,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now(),
      operation: 'profile_update'
    };
    
    // Try all endpoints for better reliability
    let successCount = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.post(`${API_BASE_URL}${endpoint}`, payload, { 
          headers: {
            ...await getAuthHeaders(),
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          },
          timeout: 3000 // Fast timeout for quick notifications
        });
        
        if (response.data && response.data.success) {
          console.log(`CLOUD DB: Successfully notified other devices via ${endpoint}`);
          successCount++;
          
          // Don't continue if we've already succeeded with one endpoint
          if (successCount >= 1) {
            break;
          }
        }
      } catch (endpointErr) {
        console.log(`CLOUD DB: Notification endpoint ${endpoint} failed: ${endpointErr.message}`);
      }
    }
    
    // Also send a GET request to trigger a server-side push notification
    try {
      const triggerUrl = `${API_BASE_URL}/api/users/trigger-sync/${encodeURIComponent(normalizedEmail)}?t=${Date.now()}`;
      await axios.get(triggerUrl, {
        headers: await getAuthHeaders(),
        timeout: 3000
      });
      console.log('CLOUD DB: Triggered server-side sync notification');
    } catch (triggerErr) {
      console.log(`CLOUD DB: Failed to trigger server-side notification: ${triggerErr.message}`);
    }
    
    if (successCount > 0) {
      return { success: true, count: successCount };
    }
    
    // As a last resort, try a PUT request which might work when POST is blocked
    try {
      const fallbackUrl = `${API_BASE_URL}/api/users/profile/sync-status`;
      const fallbackResponse = await axios.put(fallbackUrl, payload, {
        headers: await getAuthHeaders(),
        timeout: 3000
      });
      
      if (fallbackResponse.data && fallbackResponse.data.success) {
        console.log('CLOUD DB: Successfully notified via fallback method');
        return { success: true, method: 'fallback' };
      }
    } catch (fallbackErr) {
      console.log(`CLOUD DB: Fallback notification failed: ${fallbackErr.message}`);
    }
    
    // Last resort - update a timestamp for polling-based sync to detect
    try {
      await AsyncStorage.setItem(`profileChangeTimestamp_${normalizedEmail}`, Date.now().toString());
    } catch (storageErr) {
      console.log(`CLOUD DB: Failed to update local timestamp: ${storageErr.message}`);
    }
    
    return { success: false, error: 'Failed to notify other devices' };
  } catch (error) {
    console.error(`CLOUD DB: Error notifying other devices: ${error.message}`);
    
    // Last resort - update a timestamp for polling-based sync to detect
    try {
      await AsyncStorage.setItem(`profileChangeTimestamp_${email.toLowerCase().trim()}`, Date.now().toString());
    } catch (storageErr) {
      console.log(`CLOUD DB: Failed to update local timestamp: ${storageErr.message}`);
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Force synchronization of profile data across all devices
 * Call this when adding a profile image or changing name
 */
export const forceSyncAllDeviceProfiles = async (email) => {
  try {
    if (!email) {
      console.log('Email required for cross-device sync');
      return { success: false };
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`CROSS-DEVICE SYNC: Starting for ${normalizedEmail}`);
    
    // First, ensure we have the complete user data
    const userDataKey = `userData_${normalizedEmail}`;
    const userData = await AsyncStorage.getItem(userDataKey);
    
    if (!userData) {
      console.log('No user data available for cross-device sync');
      return { success: false, error: 'No user data found' };
    }
    
    const userObj = JSON.parse(userData);
    console.log(`CROSS-DEVICE SYNC: Found user data for ${userObj.name || normalizedEmail}`);
    
    // Enhanced profile image handling - check for separate storage
    let profileImage = userObj.profileImage;
    if (!profileImage || profileImage === '') {
      try {
        // Check for separately stored profile image
        const profileImageKey = `profileImage_${normalizedEmail}`;
        const separateImage = await AsyncStorage.getItem(profileImageKey);
        
        if (separateImage) {
          console.log('Found separately stored profile image, using it for sync');
          profileImage = separateImage;
          
          // Update user object with this image
          userObj.profileImage = separateImage;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
        }
      } catch (imageError) {
        console.log(`Error checking separate profile image: ${imageError.message}`);
      }
    }
    
    // First, try using our MongoDB endpoints with more aggressive retries
    let success = false;
    const endpoints = [
      '/api/user/store-mongodb',
      '/api/users/store-profile', 
      '/api/profile/cloud-store',
      '/api/user', // Traditional endpoint
      '/api/users/update', // Direct update endpoint
      '/api/profile/image/update' // Try specific image endpoint
    ];
    
    // Add device ID and timestamp for better tracking
    const deviceId = await getDeviceId();
    const dataWithMeta = {
      ...userObj,
      lastUpdatedBy: deviceId,
      lastUpdatedAt: new Date().toISOString(),
      _forceCrossDeviceSync: true,
      forceImageSync: true // Signal that this is specifically for image sync
    };
    
    // Try each endpoint with multiple retries
    const maxRetries = 3;
    
    for (const endpoint of endpoints) {
      // Try each endpoint multiple times
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`CROSS-DEVICE SYNC: Retry ${attempt+1}/${maxRetries} for endpoint ${endpoint}`);
            // Add short delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log(`CROSS-DEVICE SYNC: Trying endpoint ${endpoint}`);
          }
          
          // Different endpoints require different methods
          let response;
          if (endpoint === '/api/user' || endpoint === '/api/profile/image/update') {
            // Use PUT for these endpoints
            response = await axios.put(
              `${API_BASE_URL}${endpoint}`,
              dataWithMeta,
              { headers: await getAuthHeaders(), timeout: 20000 }
            );
          } else {
            // Use POST for the MongoDB endpoints
            response = await axios.post(
              `${API_BASE_URL}${endpoint}`,
              dataWithMeta,
              { headers: await getAuthHeaders(), timeout: 20000 }
            );
          }
          
          if (response && response.data && (response.data.success || response.data.user || response.data.profile)) {
            console.log(`CROSS-DEVICE SYNC: Successfully synced via ${endpoint}`);
            success = true;
            
            // If the server returned a profile image, make sure we save it locally
            const returnedProfile = response.data.profile || response.data.user || response.data;
            if (returnedProfile && returnedProfile.profileImage) {
              console.log('Server returned a profile image, ensuring local storage is updated');
              
              if (returnedProfile.profileImage !== userObj.profileImage) {
                // Update local storage with the server's image
                userObj.profileImage = returnedProfile.profileImage;
                await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
                
                // Also store separately
                await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, returnedProfile.profileImage);
              }
            }
            
            // Try to notify other devices
            try {
              await notifyProfileChange(normalizedEmail);
            } catch (notifyError) {
              console.log(`Failed to notify other devices: ${notifyError.message}`);
            }
            
            break; // Break out of retry loop for this endpoint
          }
        } catch (endpointError) {
          console.log(`CROSS-DEVICE SYNC: Endpoint ${endpoint} attempt ${attempt+1} failed: ${endpointError.message}`);
          // Continue with next attempt or endpoint
        }
      }
      
      if (success) break; // If any endpoint succeeded, break out of endpoints loop
    }
    
    // As a last resort, try dedicated image endpoint directly
    if (!success && profileImage) {
      try {
        console.log('CROSS-DEVICE SYNC: Trying dedicated profile image endpoint as last resort');
        
        const imageEndpoints = [
          '/api/users/profile/image',
          '/api/profile/image',
          '/api/user/profile/image'
        ];
        
        for (const imgEndpoint of imageEndpoints) {
          try {
            const imageResponse = await axios.post(
              `${API_BASE_URL}${imgEndpoint}`,
              { 
                email: normalizedEmail, 
                profileImage: profileImage,
                timestamp: Date.now()
              },
              { headers: await getAuthHeaders(), timeout: 15000 }
            );
            
            if (imageResponse && imageResponse.data && imageResponse.data.success) {
              console.log(`CROSS-DEVICE SYNC: Image sync successful via ${imgEndpoint}`);
              success = true;
              break;
            }
          } catch (imgError) {
            console.log(`CROSS-DEVICE SYNC: Image endpoint ${imgEndpoint} failed: ${imgError.message}`);
          }
        }
      } catch (lastResortError) {
        console.log(`CROSS-DEVICE SYNC: Last resort image sync failed: ${lastResortError.message}`);
      }
    }
    
    // Fallback to local sync if server methods failed
    if (!success) {
      console.log('CROSS-DEVICE SYNC: Server sync failed, storing locally for next connection');
      
      try {
        // Ensure profile image is stored separately for reliable access
        if (profileImage) {
          await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, profileImage);
          console.log('CROSS-DEVICE SYNC: Stored image separately for future syncs');
        }
        
        // Add to pending syncs for future upload
        const pendingSyncsKey = 'pendingProfileSyncs';
        const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
        const pendingSyncs = JSON.parse(pendingSyncsStr);
        
        // Check if we already have a pending sync for this user
        const existingIndex = pendingSyncs.findIndex(sync => 
          sync.email === normalizedEmail);
        
        if (existingIndex >= 0) {
          // Update existing entry with fresh data
          pendingSyncs[existingIndex] = {
            email: normalizedEmail,
            profileData: {
              ...userObj,
              _pendingSync: true,
              _imageSync: true,
              updatedAt: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
          };
        } else {
          // Add new pending sync
          pendingSyncs.push({
            email: normalizedEmail,
            profileData: {
              ...userObj,
              _pendingSync: true,
              _imageSync: true,
              updatedAt: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
          });
        }
        
        await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
        console.log('CROSS-DEVICE SYNC: Added to pending syncs for future upload');
        
        return { success: true, localOnly: true };
      } catch (fallbackError) {
        console.log(`CROSS-DEVICE SYNC: Local fallback also failed: ${fallbackError.message}`);
        return { success: false, error: fallbackError.message };
      }
    }
    
    if (success) {
      console.log('CROSS-DEVICE SYNC: Successfully synced profile across devices');
      return { success: true };
    }
    
    console.log('CROSS-DEVICE SYNC: Failed to sync with all endpoints');
    return { success: false, error: 'Failed to sync with any endpoint' };
  } catch (error) {
    console.log(`CROSS-DEVICE SYNC: Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Use the dedicated aggressive image sync endpoint
 */
export const useAggressiveImageSync = async (email, profileImage = null) => {
  try {
    if (!email) {
      console.error('Email is required for aggressive image sync');
      return { success: false, error: 'Email required' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Using aggressive image sync endpoint for: ${normalizedEmail}`);

    // Use the dedicated endpoint with proper error handling
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/sync/aggressive-image`,
        { 
          email: normalizedEmail,
          profileImage: profileImage,
          timestamp: Date.now() // Add cache-busting timestamp
        },
        { 
          headers: await getAuthHeaders(),
          timeout: 15000 // Longer timeout for image transfer
        }
      );

      if (response.data && response.data.success && response.data.profileImage) {
        console.log(`Aggressive image sync successful for: ${normalizedEmail}`);
        
        // Store the image locally for redundancy
        const profileImageKey = `profileImage_${normalizedEmail}`;
        await AsyncStorage.setItem(profileImageKey, response.data.profileImage);
        
        // Update user data with image
        const userDataKey = `userData_${normalizedEmail}`;
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          const userObj = JSON.parse(userData);
          userObj.profileImage = response.data.profileImage;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
        }
        
        return {
          success: true,
          profileImage: response.data.profileImage,
          source: 'aggressive-sync'
        };
      }
    } catch (syncError) {
      console.log(`Aggressive sync endpoint error: ${syncError.message}`);
      // Continue to fallback methods
    }
    
    // Fallback to the one-way image download endpoint
    try {
      console.log(`Trying one-way image download for: ${normalizedEmail}`);
      
      const downloadResponse = await axios.get(
        `${API_BASE_URL}/api/sync/image/${normalizedEmail}`,
        { 
          headers: await getAuthHeaders(),
          timeout: 10000
        }
      );
      
      if (downloadResponse.data && downloadResponse.data.success && downloadResponse.data.profileImage) {
        console.log(`One-way image download successful for: ${normalizedEmail}`);
        
        // Store the image locally
        const profileImageKey = `profileImage_${normalizedEmail}`;
        await AsyncStorage.setItem(profileImageKey, downloadResponse.data.profileImage);
        
        // Update user data
        const userDataKey = `userData_${normalizedEmail}`;
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          const userObj = JSON.parse(userData);
          userObj.profileImage = downloadResponse.data.profileImage;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
        }
        
        return {
          success: true,
          profileImage: downloadResponse.data.profileImage,
          source: 'one-way-download'
        };
      }
    } catch (downloadError) {
      console.log(`One-way download error: ${downloadError.message}`);
    }

    // If we have a local image already, use that
    if (profileImage) {
      console.log(`Using provided local image for: ${normalizedEmail}`);
      
      // Store for redundancy
      await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, profileImage);
      
      return {
        success: true,
        profileImage,
        source: 'provided-local'
      };
    }
    
    // Final fallback - check if we have the image stored separately
    try {
      const profileImageKey = `profileImage_${normalizedEmail}`;
      const storedImage = await AsyncStorage.getItem(profileImageKey);
      
      if (storedImage) {
        console.log(`Using separately stored image for: ${normalizedEmail}`);
        return {
          success: true,
          profileImage: storedImage,
          source: 'separate-storage'
        };
      }
    } catch (storageError) {
      console.log(`Storage access error: ${storageError.message}`);
    }
    
    return { 
      success: false,
      error: 'All aggressive image sync methods failed'
    };
  } catch (error) {
    console.error(`Aggressive image sync error: ${error.message}`);
    return { 
      success: false, 
      error: error.message
    };
  }
};

export default {
  fetchUserProfileFromDB,
  saveUserProfileToDB,
  loginWithDatabase,
  fetchProfileImageByEmail,
  forceProfileImageSync,
  cloudStoreUserProfile,
  cloudGetUserProfile,
  checkForRemoteUpdates,
  loginWithMongoDB,
  notifyProfileChange,
  forceSyncAllDeviceProfiles,
  useAggressiveImageSync
}; 