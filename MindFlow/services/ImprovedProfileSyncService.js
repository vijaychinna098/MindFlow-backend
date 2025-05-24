// ImprovedProfileSyncService.js - Enhanced sync service for profile data across devices
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, getActiveServerUrl } from '../config';
import { normalizeEmail, getDeviceId, getAuthHeaders } from './ServerSyncService';

/**
 * Get user profile with enhanced image and data handling
 * Ensures consistent profile data and images across devices
 */
export const getUserProfileWithConsistentSync = async (email) => {
  if (!email) {
    console.error('Email is required for profile sync');
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  
  // First check if we have a cached version
  try {
    const cachedUserData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
    if (cachedUserData) {
      const userData = JSON.parse(cachedUserData);
      console.log(`Found local data for: ${normalizedEmail} with profile image: ${userData.profileImage ? 'YES' : 'NO'}`);
      
      // Check if we have a separately stored profile image
      if (!userData.profileImage) {
        const profileImageKey = `profileImage_${normalizedEmail}`;
        const storedImage = await AsyncStorage.getItem(profileImageKey);
        
        if (storedImage) {
          console.log(`Profile image inconsistency detected! Adding stored image to user data`);
          userData.profileImage = storedImage;
          
          // Save the updated user data with the image
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userData));
          
          // Send profile image to server to maintain consistency
          try {
            await saveProfileToServer(userData);
          } catch (syncError) {
            console.log(`Error syncing profile image: ${syncError.message}`);
          }
        }
      }
      
      // Try to get the most up-to-date data from the server
      console.log(`Using unified sync to get latest user data...`);
      const syncResult = await unifiedSyncUserData(normalizedEmail);
      
      if (syncResult && syncResult.success && syncResult.user) {
        return syncResult.user;
      } else if (syncResult && syncResult.throttled) {
        console.log(`Global sync already in progress, throttling unified_sync_${normalizedEmail}`);
      } else {
        console.log(`Unified sync failed: ${syncResult?.error || 'Unknown error'}`);
      }
      
      console.log(`Using cached data for offline mode: ${normalizedEmail}`);
      return userData;
    }
  } catch (cacheError) {
    console.error('Error checking cache:', cacheError);
  }
  
  // If no local cache, try to fetch from server
  try {
    const serverUrl = getActiveServerUrl();
    
    // Try multiple endpoints with proper error handling
    const endpoints = [
      `/api/user/profile/${normalizedEmail}`,
      `/api/users/profile/${normalizedEmail}`,
      `/api/profile/${normalizedEmail}`,
      `/user/profile/${normalizedEmail}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying to fetch profile from: ${serverUrl}${endpoint}`);
        
        const response = await axios.get(
          `${serverUrl}${endpoint}`,
          { 
            headers: await getAuthHeaders(),
            timeout: 8000 // 8 second timeout
          }
        );
        
        if (response.data && (response.data.success || response.data.profile || response.data.user)) {
          const profile = response.data.profile || response.data.user || response.data;
          
          // Cache locally for offline access
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(profile));
          
          // Store profile image separately for redundancy
          if (profile.profileImage) {
            await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, profile.profileImage);
          }
          
          console.log(`Successfully fetched profile from server: ${profile.name || normalizedEmail}`);
          return profile;
        }
      } catch (endpointError) {
        console.log(`Failed to fetch from ${endpoint}: ${endpointError.message}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching profile from server: ${error.message}`);
  }
  
  return null;
};

/**
 * Save user profile to server with robust consistency checks
 */
export const saveProfileToServer = async (userData) => {
  if (!userData || !userData.email) {
    console.error('Invalid user data for profile save');
    return { success: false, error: 'Invalid user data' };
  }
  
  const normalizedEmail = userData.email.toLowerCase().trim();
  console.log(`Saving profile to database for: ${normalizedEmail}`);
  
  // Check if we're uploading a profile image
  if (userData.profileImage) {
    console.log(`Profile contains image: ${userData.profileImage.substring(0, 30)}...`);
  }
  
  const serverUrl = getActiveServerUrl();
  
  // Try multiple endpoints with proper error handling
  const endpoints = [
    { method: 'post', path: `/api/user/sync` },
    { method: 'post', path: `/user/sync` },
    { method: 'post', path: `/api/sync/profile` },
    { method: 'post', path: `/api/users/update` },
    { method: 'put', path: `/api/user` }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint.method.toUpperCase()} endpoint: ${serverUrl}${endpoint.path}`);
      
      const response = await axios({
        method: endpoint.method,
        url: `${serverUrl}${endpoint.path}`,
        data: {
          ...userData,
          lastSyncTime: new Date().toISOString()
        },
        headers: await getAuthHeaders(),
        timeout: 15000 // Longer timeout for profile image uploads
      });
      
      if (response.data && (response.data.success || response.data.profile || response.data.user)) {
        console.log(`Profile successfully saved using ${endpoint.path}`);
        
        // Extract the returned profile data
        const returnedProfile = response.data.user || response.data.profile || response.data;
        
        // Preserve critical data that might be missing from server response
        const preservedProfile = {
          ...returnedProfile,
          // Ensure we don't lose the profile image during sync
          profileImage: returnedProfile.profileImage || userData.profileImage,
          // Preserve other critical fields
          name: returnedProfile.name || userData.name,
          phone: returnedProfile.phone || userData.phone
        };
        
        // Cache a copy locally as backup
        await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(preservedProfile));
        
        // Store profile image separately for redundancy
        if (preservedProfile.profileImage) {
          await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, preservedProfile.profileImage);
        }
        
        return {
          success: true,
          profile: preservedProfile
        };
      }
    } catch (endpointError) {
      console.log(`Failed endpoint ${endpoint.path}: ${endpointError.message}`);
    }
  }
  
  // If all server endpoints failed, store locally for later sync
  console.log(`Failed to save profile to server, storing locally for later sync`);
  
  try {
    // Cache locally for later sync
    await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userData));
    
    // Store profile image separately for redundancy
    if (userData.profileImage) {
      await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, userData.profileImage);
    }
    
    // Add to pending syncs queue
    const pendingSyncsKey = 'pendingProfileSyncs';
    const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
    const pendingSyncs = JSON.parse(pendingSyncsStr);
    
    // Add to pending syncs if not already there
    const existingIndex = pendingSyncs.findIndex(sync => sync.email === normalizedEmail);
    
    if (existingIndex >= 0) {
      // Update existing entry
      pendingSyncs[existingIndex] = {
        email: normalizedEmail,
        profileData: userData,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new entry
      pendingSyncs.push({
        email: normalizedEmail,
        profileData: userData,
        updatedAt: new Date().toISOString()
      });
    }
    
    await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
  } catch (storageError) {
    console.log(`Error storing profile locally: ${storageError.message}`);
  }
  
  return {
    success: false,
    error: 'Failed to save profile to server',
    localOnly: true
  };
};

/**
 * Unified user data sync with improved profile handling
 */
export const unifiedSyncUserData = async (userEmail) => {
  if (!userEmail) {
    console.error('Email is required for sync');
    return { success: false, error: 'Email required' };
  }
  
  const normalizedEmail = userEmail.toLowerCase().trim();
  console.log(`Starting unified data sync for ${normalizedEmail}...`);
  
  // Get local data first
  let localUserData = null;
  try {
    const userDataKey = `userData_${normalizedEmail}`;
    const localData = await AsyncStorage.getItem(userDataKey);
    
    if (localData) {
      localUserData = JSON.parse(localData);
      console.log(`Found local data for: ${normalizedEmail}`);
      
      // Check if we have a separately stored profile image
      if (!localUserData.profileImage) {
        const profileImageKey = `profileImage_${normalizedEmail}`;
        const storedImage = await AsyncStorage.getItem(profileImageKey);
        
        if (storedImage) {
          console.log(`Found separately stored profile image for ${normalizedEmail}, including in sync`);
          localUserData.profileImage = storedImage;
        }
      }
    } else {
      console.log(`No local data found for: ${normalizedEmail}`);
      return { success: false, error: 'No local data available' };
    }
  } catch (localError) {
    console.log(`Error reading local data: ${localError.message}`);
    return { success: false, error: `Error reading local data: ${localError.message}` };
  }
  
  const serverUrl = getActiveServerUrl();
  
  // Create headers with authentication token
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    console.log('No auth token available for sync');
    return { success: false, error: 'Authentication required' };
  }
  
  // Define multiple endpoints to try in case of failure
  const syncEndpoints = [
    { url: `${serverUrl}/api/user/sync`, method: 'post' },
    { url: `${serverUrl}/user/sync`, method: 'post' },
    { url: `${serverUrl}/api/sync/profile`, method: 'post' },
    { url: `${serverUrl}/api/users/update`, method: 'post' }
  ];
  
  let response = null;
  let syncError = null;
  
  // Try each endpoint until one succeeds
  for (const endpoint of syncEndpoints) {
    try {
      console.log(`Trying sync endpoint: ${endpoint.url}`);
      
      response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        data: { 
          clientData: localUserData,
          lastSyncTime: localUserData.lastSyncTime || new Date().toISOString()
        },
        headers,
        timeout: 15000 // 15 second timeout
      });
      
      if (response.data && response.data.success) {
        console.log(`Sync successful via ${endpoint.url}`);
        break; // Exit the loop if successful
      }
    } catch (endpointError) {
      console.log(`Endpoint ${endpoint.url} failed: ${endpointError.message}`);
      syncError = endpointError;
      // Continue to the next endpoint
    }
  }
  
  // Handle the response
  if (response && response.data && response.data.success && (response.data.user || response.data.profile)) {
    const serverData = response.data.user || response.data.profile;
    console.log(`Sync successful for ${normalizedEmail}`);
    
    // Save the profile image separately for redundancy
    if (serverData.profileImage) {
      try {
        const profileImageKey = `profileImage_${normalizedEmail}`;
        await AsyncStorage.setItem(profileImageKey, serverData.profileImage);
        console.log(`Saved profile image separately for ${normalizedEmail}`);
      } catch (saveImageError) {
        console.log(`Error saving profile image separately: ${saveImageError.message}`);
      }
    }
    
    // Handle case where server is missing profile image but we have it locally
    if (!serverData.profileImage && localUserData.profileImage) {
      console.log('Server missing profile image, using local image and updating server');
      serverData.profileImage = localUserData.profileImage;
      
      // Try to send our image to the server
      try {
        await saveProfileToServer({
          ...serverData,
          profileImage: localUserData.profileImage
        });
      } catch (updateError) {
        console.log(`Error updating server with local image: ${updateError.message}`);
      }
    }
    
    // Store the latest data in AsyncStorage
    const userDataKey = `userData_${normalizedEmail}`;
    await AsyncStorage.setItem(userDataKey, JSON.stringify(serverData));
    
    // Update last sync time
    await AsyncStorage.setItem(`lastSyncTime_${normalizedEmail}`, new Date().toISOString());
    
    return {
      success: true,
      user: serverData,
      source: 'server'
    };
  }
  
  // Return local data as fallback
  console.log(`Using cached data for offline mode: ${normalizedEmail}`);
  return { 
    success: false, 
    error: syncError ? syncError.message : 'Failed to sync data with server',
    source: 'local_fallback',
    user: localUserData
  };
};

/**
 * Process pending profile syncs
 */
export const processPendingProfileSyncs = async () => {
  console.log('Checking for pending profile syncs to process...');
  
  try {
    // Get all pending syncs
    const pendingSyncsKey = 'pendingProfileSyncs';
    const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
    const pendingSyncs = JSON.parse(pendingSyncsStr);
    
    if (pendingSyncs.length === 0) {
      console.log('No pending profile syncs to process');
      return { success: true, count: 0 };
    }
    
    console.log(`Processing pending profile synchronizations...`);
    console.log(`Found ${pendingSyncs.length} pending profile syncs to process`);
    
    const updatedPendingSyncs = [];
    let successCount = 0;
    
    for (const pendingSync of pendingSyncs) {
      console.log(`Processing pending sync for ${pendingSync.email}`);
      
      const result = await saveProfileToServer(pendingSync.profileData);
      
      if (result.success) {
        console.log(`Successfully synced pending profile for ${pendingSync.email}`);
        successCount++;
      } else {
        console.log(`All sync attempts failed for ${pendingSync.email}, will retry later`);
        // Keep in the pending list for retry
        updatedPendingSyncs.push(pendingSync);
      }
    }
    
    // Save updated list of pending syncs
    await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(updatedPendingSyncs));
    
    console.log(`${successCount} pending syncs processed successfully, ${updatedPendingSyncs.length} remaining`);
    
    if (updatedPendingSyncs.length > 0) {
      console.log('No pending profile syncs to process');
    }
    
    return { 
      success: true, 
      processed: successCount,
      remaining: updatedPendingSyncs.length
    };
  } catch (error) {
    console.error(`Error processing pending syncs: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Direct device-to-device profile sync
 * More aggressive approach to ensure profile consistency across devices
 */
export const directDeviceToDeviceSync = async (email) => {
  if (!email) {
    console.log('Email required for direct device sync');
    return { success: false, error: 'Email required' };
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  console.log(`Attempting direct device-to-device profile sync...`);
  
  // Check if we've done this recently to prevent excessive syncs
  try {
    const lastSyncKey = `lastDirectSync_${normalizedEmail}`;
    const lastSyncStr = await AsyncStorage.getItem(lastSyncKey);
    
    if (lastSyncStr) {
      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      const diffSeconds = (now - lastSync) / 1000;
      
      if (diffSeconds < 60) { // Don't sync more than once per minute
        console.log(`Skipping direct device-to-device sync - last sync was ${Math.floor(diffSeconds)}s ago`);
        return { success: false, skipped: true };
      }
    }
    
    // Set last sync time
    await AsyncStorage.setItem(lastSyncKey, new Date().toISOString());
  } catch (timeError) {
    console.log(`Error checking last sync time: ${timeError.message}`);
  }
  
  // Try to get local data first
  try {
    const userDataKey = `userData_${normalizedEmail}`;
    const userData = await AsyncStorage.getItem(userDataKey);
    
    if (!userData) {
      console.log(`No local data found for direct sync: ${normalizedEmail}`);
      return { success: false, error: 'No local data available' };
    }
    
    const userObj = JSON.parse(userData);
    
    // Check for profile image in separate storage
    if (!userObj.profileImage) {
      const profileImageKey = `profileImage_${normalizedEmail}`;
      const storedImage = await AsyncStorage.getItem(profileImageKey);
      
      if (storedImage) {
        console.log(`Found separately stored profile image, adding to user data for sync`);
        userObj.profileImage = storedImage;
      }
    }
    
    // Try aggressive sync
    const serverUrl = getActiveServerUrl();
    
    // Try multiple endpoints with short timeouts for faster sync
    const syncEndpoints = [
      { url: `${serverUrl}/api/sync/direct-device`, method: 'post' },
      { url: `${serverUrl}/api/user/sync-device`, method: 'post' },
      { url: `${serverUrl}/api/profile/direct-sync`, method: 'post' }
    ];
    
    // Enhanced payload with device info
    const syncPayload = {
      userData: userObj,
      deviceId: await getDeviceId(),
      timestamp: Date.now(),
      lastSyncTime: userObj.lastSyncTime || new Date().toISOString()
    };
    
    for (const endpoint of syncEndpoints) {
      try {
        console.log(`Trying direct sync endpoint: ${endpoint.url}`);
        
        const response = await axios({
          method: endpoint.method,
          url: endpoint.url,
          data: syncPayload,
          headers: await getAuthHeaders(),
          timeout: 10000 // 10 second timeout
        });
        
        if (response.data && response.data.success) {
          console.log(`Direct device sync successful via ${endpoint.url}`);
          
          // If server returned updated data, save it locally
          if (response.data.userData) {
            console.log(`Received updated user data from server`);
            
            const receivedData = response.data.userData;
            
            // Merge with our local data to avoid losing any fields
            const mergedData = {
              ...userObj,
              ...receivedData,
              // Never lose profile image in sync
              profileImage: receivedData.profileImage || userObj.profileImage
            };
            
            // Save to local storage
            await AsyncStorage.setItem(userDataKey, JSON.stringify(mergedData));
            
            // Also save profile image separately if it exists
            if (mergedData.profileImage) {
              await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, mergedData.profileImage);
            }
            
            return {
              success: true,
              userData: mergedData,
              dataUpdated: true
            };
          }
          
          return { success: true };
        }
      } catch (endpointError) {
        console.log(`Direct sync endpoint ${endpoint.url} failed: ${endpointError.message}`);
      }
    }
    
    console.log(`All direct sync endpoints failed, will try again later`);
    return {
      success: false,
      error: 'All direct sync endpoints failed'
    };
  } catch (error) {
    console.log(`Error in direct device-to-device sync: ${error.message}`);
    return { success: false, error: error.message };
  }
};

export default {
  getUserProfileWithConsistentSync,
  saveProfileToServer,
  unifiedSyncUserData,
  processPendingProfileSyncs,
  directDeviceToDeviceSync
};
