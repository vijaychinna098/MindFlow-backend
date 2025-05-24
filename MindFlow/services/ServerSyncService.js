// ServerSyncService.js - Service for syncing data with the server
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, getActiveServerUrl } from '../config';

// Global sync lock to prevent concurrent syncs
let globalSyncInProgress = false;
let lastGlobalSyncTime = 0;
const GLOBAL_SYNC_COOLDOWN = 5000; // 5 seconds minimum between global syncs

// Throttling mechanism to prevent excessive sync attempts
const syncAttemptTimestamps = {};
const MIN_SYNC_INTERVAL = 30000; // 30 seconds minimum between sync attempts

// Helper function to check if sync should be throttled
const shouldThrottleSync = (key) => {
  // Check global sync lock first
  const now = Date.now();
  if (globalSyncInProgress) {
    console.log(`Global sync already in progress, throttling ${key}`);
    return true;
  }
  
  // Check global cooldown
  const timeSinceLastGlobalSync = now - lastGlobalSyncTime;
  if (timeSinceLastGlobalSync < GLOBAL_SYNC_COOLDOWN) {
    console.log(`Global sync cooldown active (${Math.floor((GLOBAL_SYNC_COOLDOWN - timeSinceLastGlobalSync)/1000)}s remaining), throttling ${key}`);
    return true;
  }
  
  // Check key-specific throttling
  const lastAttempt = syncAttemptTimestamps[key] || 0;
  const timeSinceLastAttempt = now - lastAttempt;
  
  if (timeSinceLastAttempt < MIN_SYNC_INTERVAL) {
    console.log(`Throttling sync for ${key} - last attempt was ${timeSinceLastAttempt}ms ago`);
    return true;
  }
  
  // Update timestamp for this key
  syncAttemptTimestamps[key] = now;
  lastGlobalSyncTime = now;
  return false;
};

// Helper function to acquire sync lock
const acquireSyncLock = () => {
  if (globalSyncInProgress) {
    return false;
  }
  globalSyncInProgress = true;
  return true;
};

// Helper function to release sync lock
const releaseSyncLock = () => {
  globalSyncInProgress = false;
};

// Helper for email normalization
const normalizeEmail = (email) => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

// Helper to validate email
const isValidEmail = (email) => {
  if (!email) return false;
  // Basic email validation
  const normalizedEmail = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
};

// Helper function for making safe API calls
const safeApiCall = async (apiCall, defaultValue = {}, errorMessage = "API call failed") => {
  try {
    const response = await apiCall();
    return response?.data || defaultValue;
  } catch (error) {
    console.error(`${errorMessage}:`, error?.message || 'Unknown error');
    return defaultValue;
  }
};

// Create auth headers for API calls
const getAuthHeaders = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      return {};
    }
    
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    return {};
  }
};

// Get caregiver auth headers
const getCaregiverAuthHeaders = async () => {
  try {
    const caregiverData = await AsyncStorage.getItem('caregiverData');
    if (!caregiverData) {
      return {};
    }
    
    const caregiver = JSON.parse(caregiverData);
    if (!caregiver.token) {
      return {};
    }
    
    return {
      Authorization: `Bearer ${caregiver.token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    console.error('Error getting caregiver auth headers:', error);
    return {};
  }
};

// New improved unified sync function using the new backend endpoint
export const unifiedSyncUserData = async (userEmail) => {
  if (!isValidEmail(userEmail)) {
    console.error('Invalid email provided for sync');
    return { success: false, error: 'Invalid email' };
  }
  
  const syncKey = `unified_sync_${userEmail}`;
  if (shouldThrottleSync(syncKey)) {
    return { success: false, error: 'Sync throttled', throttled: true };
  }
  
  try {
    if (!acquireSyncLock()) {
      return { success: false, error: 'Sync already in progress', locked: true };
    }
    
    console.log(`Starting unified data sync for ${userEmail}...`);
    const normalizedEmail = normalizeEmail(userEmail);
    const serverUrl = getActiveServerUrl();
    
    // Get local data first
    let localUserData = null;
    const userDataKey = `userData_${normalizedEmail}`;
    try {
      const localData = await AsyncStorage.getItem(userDataKey);
      if (localData) {
        localUserData = JSON.parse(localData);
        console.log(`Found local data for: ${userEmail}`);
      }
    } catch (localError) {
      console.log(`Error reading local data: ${localError.message}`);
    }
    
    if (!localUserData) {
      console.log('No local data available for sync');
      releaseSyncLock();
      return { success: false, error: 'No local data available' };
    }
    
    // Get the last sync time
    const lastSyncTime = await AsyncStorage.getItem(`lastSyncTime_${normalizedEmail}`) || 
                          localUserData.lastSyncTime || 
                          new Date().toISOString();
    
    // Check if we have a local profile image that needs to be included
    if (!localUserData.profileImage) {
      try {
        // Check if we have a separately stored profile image for this email
        const profileImageKey = `profileImage_${normalizedEmail}`;
        const storedImage = await AsyncStorage.getItem(profileImageKey);
        
        if (storedImage) {
          console.log(`Found separately stored profile image for ${normalizedEmail}, including in sync`);
          localUserData.profileImage = storedImage;
        }
      } catch (imageError) {
        console.log(`Error checking for profile image: ${imageError.message}`);
      }
    }
    
    // Prepare data for sync
    const clientData = {
      ...localUserData,
      email: normalizedEmail
    };
    
    // Create headers with authentication token
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      console.log('No auth token available for sync');
      releaseSyncLock();
      return { success: false, error: 'Authentication required' };
    }
    
    // Call the unified sync endpoint
    console.log(`Calling unified sync endpoint for ${normalizedEmail}...`);
    
    // Define multiple endpoints to try in case of failure
    const syncEndpoints = [
      { url: `${serverUrl}/api/user/sync`, method: 'post' },
      { url: `${serverUrl}/user/sync`, method: 'post' },
      { url: `${serverUrl}/api/sync/profile`, method: 'post' }
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
            clientData,
            lastSyncTime
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
    if (response.data && response.data.success && response.data.user) {
      const serverData = response.data.user;
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
      
      // Store the latest data in AsyncStorage
      await AsyncStorage.setItem(userDataKey, JSON.stringify(serverData));
      
      // Update last sync time
      await AsyncStorage.setItem(`lastSyncTime_${normalizedEmail}`, serverData.lastSyncTime);
      
      // Handle conflicts if any
      if (response.data.conflicts && response.data.conflicts.length > 0) {
        console.log(`${response.data.conflicts.length} conflicts detected during sync`);
        
        // Store conflicts for later resolution if needed
        await AsyncStorage.setItem(
          `syncConflicts_${normalizedEmail}`, 
          JSON.stringify(response.data.conflicts)
        );
      }
      
      releaseSyncLock();
      return {
        success: true,
        user: serverData,
        conflicts: response.data.conflicts || [],
        source: 'server'
      };
    }
    
    releaseSyncLock();
    return { 
      success: false, 
      error: 'Failed to sync data with server',
      source: 'local_fallback',
      user: localUserData
    };
  } catch (error) {
    console.error(`Unified sync error for ${userEmail}:`, error.message);
    releaseSyncLock();
    
    // Return local data as fallback
    try {
      const normalizedEmail = normalizeEmail(userEmail);
      const userDataKey = `userData_${normalizedEmail}`;
      const localDataStr = await AsyncStorage.getItem(userDataKey);
      
      if (localDataStr) {
        const localUserData = JSON.parse(localDataStr);
        return {
          success: false,
          error: error.message,
          source: 'local_fallback',
          offline: true,
          user: localUserData
        };
      }
    } catch (fallbackError) {
      console.error('Error retrieving local fallback data:', fallbackError.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Queue system for offline changes
const PENDING_SYNCS_KEY = 'pendingDataSyncs';

// Add data to sync queue when offline
export const queueOfflineChange = async (userEmail, dataType, data) => {
  try {
    const normalizedEmail = normalizeEmail(userEmail);
    
    // Get existing queue
    const pendingSyncsStr = await AsyncStorage.getItem(PENDING_SYNCS_KEY);
    const pendingSyncs = pendingSyncsStr ? JSON.parse(pendingSyncsStr) : [];
    
    // Add new pending sync
    pendingSyncs.push({
      email: normalizedEmail,
      dataType,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Save updated queue
    await AsyncStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(pendingSyncs));
    
    console.log(`Added offline change to sync queue: ${dataType} for ${normalizedEmail}`);
    return true;
  } catch (error) {
    console.error('Error queuing offline change:', error);
    return false;
  }
};

// Process offline changes queue when back online
export const processOfflineChangesQueue = async () => {
  try {
    // Check if we have pending syncs
    const pendingSyncsStr = await AsyncStorage.getItem(PENDING_SYNCS_KEY);
    if (!pendingSyncsStr) {
      return { success: true, processed: 0 };
    }
    
    const pendingSyncs = JSON.parse(pendingSyncsStr);
    if (!pendingSyncs.length) {
      return { success: true, processed: 0 };
    }
    
    console.log(`Processing ${pendingSyncs.length} offline changes...`);
    let processedCount = 0;
    
    // Group by email for more efficient processing
    const syncsByEmail = {};
    pendingSyncs.forEach(sync => {
      if (!syncsByEmail[sync.email]) {
        syncsByEmail[sync.email] = [];
      }
      syncsByEmail[sync.email].push(sync);
    });
    
    // Process each user's changes
    for (const email of Object.keys(syncsByEmail)) {
      console.log(`Processing offline changes for ${email}...`);
      
      try {
        // Get latest local data
        const userDataKey = `userData_${email}`;
        const localDataStr = await AsyncStorage.getItem(userDataKey);
        
        if (localDataStr) {
          const localUserData = JSON.parse(localDataStr);
          
          // Apply all pending changes to local data
          syncsByEmail[email].forEach(sync => {
            if (sync.dataType === 'reminders' && localUserData.reminders) {
              // Handle reminder changes
              console.log('Applying offline reminder changes');
              // Process based on the operation (add/update/delete)
              if (sync.data.operation === 'add') {
                localUserData.reminders.push(sync.data.reminder);
              } else if (sync.data.operation === 'update') {
                const index = localUserData.reminders.findIndex(r => r.id === sync.data.reminder.id);
                if (index !== -1) {
                  localUserData.reminders[index] = sync.data.reminder;
                }
              } else if (sync.data.operation === 'delete') {
                localUserData.reminders = localUserData.reminders.filter(r => r.id !== sync.data.id);
              }
            } else if (sync.dataType === 'memories' && localUserData.memories) {
              // Handle memory changes
              console.log('Applying offline memory changes');
              if (sync.data.operation === 'add') {
                localUserData.memories.push(sync.data.memory);
              } else if (sync.data.operation === 'update') {
                const index = localUserData.memories.findIndex(m => m.id === sync.data.memory.id);
                if (index !== -1) {
                  localUserData.memories[index] = sync.data.memory;
                }
              } else if (sync.data.operation === 'delete') {
                localUserData.memories = localUserData.memories.filter(m => m.id !== sync.data.id);
              }
            } else if (sync.dataType === 'contacts' && localUserData.emergencyContacts) {
              // Handle contact changes
              console.log('Applying offline contact changes');
              if (sync.data.operation === 'add') {
                localUserData.emergencyContacts.push(sync.data.contact);
              } else if (sync.data.operation === 'update') {
                const index = localUserData.emergencyContacts.findIndex(c => c.id === sync.data.contact.id);
                if (index !== -1) {
                  localUserData.emergencyContacts[index] = sync.data.contact;
                }
              } else if (sync.data.operation === 'delete') {
                localUserData.emergencyContacts = localUserData.emergencyContacts.filter(c => c.id !== sync.data.id);
              }
            } else if (sync.dataType === 'profile') {
              // Handle profile changes
              console.log('Applying offline profile changes');
              Object.assign(localUserData, sync.data);
            }
          });
          
          // Now sync the combined changes to the server
          const syncResult = await unifiedSyncUserData(email);
          
          if (syncResult.success) {
            processedCount += syncsByEmail[email].length;
          }
        }
      } catch (userError) {
        console.error(`Error processing offline changes for ${email}:`, userError);
      }
    }
    
    // Clear processed syncs
    if (processedCount > 0) {
      await AsyncStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify([]));
    }
    
    return {
      success: true,
      processed: processedCount
    };
  } catch (error) {
    console.error('Error processing offline changes:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// USER SYNC FUNCTIONS

// Sync user reminders with server
export const syncUserReminders = async (userEmail) => {
  try {
    console.log(`Syncing reminders for user: ${userEmail}...`);
    const url = `${getActiveServerUrl()}/api/user/sync/reminders`;
    const headers = await getAuthHeaders();
    const normalizedEmail = normalizeEmail(userEmail);
    
    // First, check if we have local reminders
    const localRemindersKey = `reminders_${normalizedEmail}`;
    const localRemindersStr = await AsyncStorage.getItem(localRemindersKey);
    const localReminders = localRemindersStr ? JSON.parse(localRemindersStr) : [];
    
    // Save local reminders to server
    if (localReminders.length > 0) {
      console.log(`Uploading ${localReminders.length} reminders to server...`);
      await axios.post(url, { reminders: localReminders }, { headers });
    }
    
    // Get the latest reminders from the server
    const response = await axios.get(url, { headers });
    
    // Update local storage with server data
    if (response.data && response.data.reminders) {
      const serverReminders = response.data.reminders;
      console.log(`Received ${serverReminders.length} reminders from server`);
      
      // Save the server version to local storage
      await AsyncStorage.setItem(localRemindersKey, JSON.stringify(serverReminders));
      
      return {
        success: true,
        reminders: serverReminders
      };
    }
    
    return {
      success: true,
      reminders: localReminders
    };
  } catch (error) {
    console.error('Error syncing user reminders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync user memories with server
export const syncUserMemories = async (userEmail) => {
  try {
    console.log(`Syncing memories for user: ${userEmail}...`);
    const url = `${getActiveServerUrl()}/api/user/sync/memories`;
    const headers = await getAuthHeaders();
    const normalizedEmail = normalizeEmail(userEmail);
    
    // First, check if we have local memories
    const localMemoriesKey = `memories_${normalizedEmail}`;
    const localMemoriesStr = await AsyncStorage.getItem(localMemoriesKey);
    const localMemories = localMemoriesStr ? JSON.parse(localMemoriesStr) : [];
    
    // Save local memories to server
    if (localMemories.length > 0) {
      console.log(`Uploading ${localMemories.length} memories to server...`);
      await axios.post(url, { memories: localMemories }, { headers });
    }
    
    // Get the latest memories from the server
    const response = await axios.get(url, { headers });
    
    // Update local storage with server data
    if (response.data && response.data.memories) {
      const serverMemories = response.data.memories;
      console.log(`Received ${serverMemories.length} memories from server`);
      
      // Save the server version to local storage
      await AsyncStorage.setItem(localMemoriesKey, JSON.stringify(serverMemories));
      
      return {
        success: true,
        memories: serverMemories
      };
    }
    
    return {
      success: true,
      memories: localMemories
    };
  } catch (error) {
    console.error('Error syncing user memories:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync user emergency contacts with server
export const syncUserContacts = async (userEmail) => {
  try {
    console.log(`Syncing emergency contacts for user: ${userEmail}...`);
    const url = `${getActiveServerUrl()}/api/user/sync/contacts`;
    const headers = await getAuthHeaders();
    const normalizedEmail = normalizeEmail(userEmail);
    
    // First, check if we have local contacts
    const localContactsKey = `emergencyContacts_${normalizedEmail}`;
    const localContactsStr = await AsyncStorage.getItem(localContactsKey);
    const localContacts = localContactsStr ? JSON.parse(localContactsStr) : [];
    
    // Save local contacts to server
    if (localContacts.length > 0) {
      console.log(`Uploading ${localContacts.length} emergency contacts to server...`);
      await axios.post(url, { contacts: localContacts }, { headers });
    }
    
    // Get the latest contacts from the server
    const response = await axios.get(url, { headers });
    
    // Update local storage with server data
    if (response.data && response.data.contacts) {
      const serverContacts = response.data.contacts;
      console.log(`Received ${serverContacts.length} emergency contacts from server`);
      
      // Save the server version to local storage
      await AsyncStorage.setItem(localContactsKey, JSON.stringify(serverContacts));
      
      return {
        success: true,
        contacts: serverContacts
      };
    }
    
    return {
      success: true,
      contacts: localContacts
    };
  } catch (error) {
    console.error('Error syncing user emergency contacts:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync user home location with server
export const syncUserHomeLocation = async (userEmail) => {
  try {
    console.log(`Syncing home location for user: ${userEmail}...`);
    const url = `${getActiveServerUrl()}/api/user/sync/homeLocation`;
    const headers = await getAuthHeaders();
    const normalizedEmail = normalizeEmail(userEmail);
    
    // First, check if we have a local home location
    const localHomeLocationKey = `homeLocation_${normalizedEmail}`;
    const localHomeLocationStr = await AsyncStorage.getItem(localHomeLocationKey);
    
    if (localHomeLocationStr) {
      const homeLocation = JSON.parse(localHomeLocationStr);
      
      // Save local home location to server
      console.log('Uploading home location to server...');
      await axios.post(url, { homeLocation }, { headers });
      
      return {
        success: true,
        homeLocation
      };
    }
    
    return {
      success: true,
      homeLocation: null
    };
  } catch (error) {
    console.error('Error syncing user home location:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync user profile with server and ensure cross-device compatibility
export const syncUserProfile = async (userEmail) => {
  try {
    const normalizedEmail = normalizeEmail(userEmail);
    const syncKey = `profile_${normalizedEmail}`;
    
    // Make the sync interval shorter to ensure faster updates
    const profileSyncInterval = 5000; // 5 seconds (was 30 seconds)
    
    // Check last sync time
    const now = Date.now();
    const lastAttempt = syncAttemptTimestamps[syncKey] || 0;
    const timeSinceLastAttempt = now - lastAttempt;
    
    // Apply minimal throttling with a shorter interval for profiles
    if (timeSinceLastAttempt < profileSyncInterval || globalSyncInProgress) {
      console.log(`Profile sync throttled for ${normalizedEmail} - will retry in ${Math.floor((profileSyncInterval - timeSinceLastAttempt)/1000)}s`);
      
      // Return cached data only if we're throttled
      const userDataKey = `userData_${normalizedEmail}`;
      const storedUserData = await AsyncStorage.getItem(userDataKey);
      
      if (storedUserData) {
        return {
          success: true,
          profile: JSON.parse(storedUserData),
          source: 'cache'
        };
      }
      
      return {
        success: false,
        error: 'Sync throttled, no cached data available',
        throttled: true
      };
    }
    
    // Attempt to acquire sync lock
    if (!acquireSyncLock()) {
      console.log(`Cannot acquire sync lock for ${normalizedEmail}, another sync is in progress`);
      // Return cached data only if we can't acquire the lock
      const userDataKey = `userData_${normalizedEmail}`;
      const storedUserData = await AsyncStorage.getItem(userDataKey);
      
      if (storedUserData) {
        return {
          success: true,
          profile: JSON.parse(storedUserData),
          source: 'cache'
        };
      }
      
      return {
        success: false,
        error: 'Sync in progress, no cached data available',
        throttled: true
      };
    }
    
    try {
      // Update timestamp for this sync operation
      syncAttemptTimestamps[syncKey] = now;
      
      console.log(`==== FETCHING USER PROFILE FROM DATABASE: ${userEmail} ====`);
      
      // Check server connectivity first
      let serverAvailable = false;
      let serverUrl = '';
      try {
        serverUrl = await getActiveServerUrl();
        const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
        serverAvailable = pingResponse.status === 200;
        console.log(`Server availability for profile sync: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
      } catch (error) {
        console.log(`Server unavailable for profile sync: ${error.message}`);
        serverAvailable = false;
      }
      
      // If server is available, ALWAYS try to fetch from server first
      if (serverAvailable) {
        try {
          // Try multiple endpoints to get the most up-to-date profile
          console.log(`Fetching user profile from database: ${normalizedEmail}`);
          
          // Try each endpoint in order of likelihood of success
          const endpoints = [
            // UPDATED: Use the most reliable endpoints first
            `/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
            `/api/users/${encodeURIComponent(normalizedEmail)}`,
            `/api/user?email=${encodeURIComponent(normalizedEmail)}`,
            `/api/profile/${encodeURIComponent(normalizedEmail)}`
          ];
          
          for (const endpoint of endpoints) {
            try {
              console.log(`Trying endpoint: ${endpoint}`);
              const response = await axios.get(`${serverUrl}${endpoint}`, { 
                timeout: 10000,
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              // Handle different response structures
              let serverProfile = null;
              if (response.data && response.data.user) {
                serverProfile = response.data.user;
              } else if (response.data && response.data.data) {
                serverProfile = response.data.data;
              } else if (response.data && response.data.profile) {
                serverProfile = response.data.profile;
              } else if (response.data && response.data.email) {
                // Direct user object
                serverProfile = response.data;
              }
              
              if (serverProfile) {
                console.log(`Retrieved user profile from ${endpoint}: ${serverProfile.name || normalizedEmail}`);
                
                // Store in local cache as backup for offline
                await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(serverProfile));
                
                releaseSyncLock(); // Release lock before returning
                return {
                  success: true,
                  profile: serverProfile,
                  source: 'server'
                };
              }
            } catch (endpointError) {
              console.log(`Endpoint ${endpoint} failed: ${endpointError.message}`);
              // Continue to next endpoint
            }
          }
          
          // If all endpoints failed, try a direct fetch with POST
          try {
            console.log('Trying direct profile fetch with POST request');
            const directResponse = await axios.post(`${serverUrl}/api/users/get-profile`, {
              email: normalizedEmail
            }, { 
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (directResponse.data && (directResponse.data.user || directResponse.data.profile || directResponse.data.data)) {
              const serverProfile = directResponse.data.user || directResponse.data.profile || directResponse.data.data;
              console.log(`Retrieved user profile from direct POST request: ${serverProfile.name || normalizedEmail}`);
              
              // Store in local cache as backup for offline
              await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(serverProfile));
              
              releaseSyncLock(); // Release lock before returning
              return {
                success: true,
                profile: serverProfile,
                source: 'server_direct'
              };
            }
          } catch (directError) {
            console.log(`Direct profile fetch failed: ${directError.message}`);
          }
        } catch (serverError) {
          console.log(`Error fetching from server: ${serverError.message}`);
        }
      }
      
      // If we reach here, server fetch failed or server is offline
      // Use local cache as FALLBACK only
      console.log(`Server fetch failed, using local cache as fallback for: ${normalizedEmail}`);
      
      const userDataKey = `userData_${normalizedEmail}`;
      const storedUserData = await AsyncStorage.getItem(userDataKey);
      
      if (storedUserData) {
        console.log(`Using cached data for: ${normalizedEmail} (SERVER UNAVAILABLE)`);
        
        // Track that we're using offline data
        await AsyncStorage.setItem(`lastOfflineAccess_${normalizedEmail}`, now.toString());
        
        releaseSyncLock(); // Release lock before returning
        return {
          success: true,
          profile: JSON.parse(storedUserData),
          source: 'local_fallback',
          offline: true
        };
      }
      
      // If no local data, we have no profile
      console.log(`No profile data available for ${normalizedEmail} - server offline and no local cache`);
      releaseSyncLock(); // Release lock before returning
      return {
        success: false,
        error: 'No profile data available locally or on server',
        offline: !serverAvailable
      };
    } catch (error) {
      releaseSyncLock(); // Make sure to release the lock in case of error
      throw error;
    }
  } catch (error) {
    console.error(`Error syncing user profile: ${error.message}`);
    releaseSyncLock(); // Ensure lock is released on error
    return {
      success: false,
      error: error.message
    };
  }
};

// CAREGIVER SYNC FUNCTIONS

// Sync patient reminders from caregiver
export const syncCaregiverReminders = async (caregiverId, patientEmail) => {
  try {
    console.log(`Syncing caregiver reminders for patient: ${patientEmail}...`);
    const url = `${getActiveServerUrl()}/api/caregivers/sync/patient-reminders`;
    const headers = await getCaregiverAuthHeaders();
    const normalizedEmail = normalizeEmail(patientEmail);
    
    // Get caregiver reminders for this patient
    const caregiverRemindersKey = `reminders_${caregiverId}`;
    const allCaregiverRemindersStr = await AsyncStorage.getItem(caregiverRemindersKey);
    const allCaregiverReminders = allCaregiverRemindersStr ? JSON.parse(allCaregiverRemindersStr) : [];
    
    // Filter for this patient only
    const patientReminders = allCaregiverReminders.filter(reminder => 
      reminder && 
      reminder.forPatient && 
      normalizeEmail(reminder.forPatient) === normalizedEmail
    );
    
    if (patientReminders.length > 0) {
      console.log(`Uploading ${patientReminders.length} reminders for patient ${patientEmail}...`);
      
      // Send to server
      await axios.post(url, {
        caregiverId,
        patientEmail: normalizedEmail,
        reminders: patientReminders
      }, { headers });
      
      return {
        success: true,
        count: patientReminders.length
      };
    }
    
    return {
      success: true,
      count: 0
    };
  } catch (error) {
    console.error('Error syncing caregiver reminders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync patient memories from caregiver
export const syncCaregiverMemories = async (caregiverId, patientEmail) => {
  try {
    console.log(`Syncing caregiver memories for patient: ${patientEmail}...`);
    const url = `${getActiveServerUrl()}/api/caregivers/sync/patient-memories`;
    const headers = await getCaregiverAuthHeaders();
    const normalizedEmail = normalizeEmail(patientEmail);
    
    // Get caregiver memories for this patient
    const caregiverMemoriesKey = `memories_${caregiverId}`;
    const allCaregiverMemoriesStr = await AsyncStorage.getItem(caregiverMemoriesKey);
    const allCaregiverMemories = allCaregiverMemoriesStr ? JSON.parse(allCaregiverMemoriesStr) : [];
    
    // Filter for this patient only
    const patientMemories = allCaregiverMemories.filter(memory => 
      memory && 
      memory.forPatient && 
      normalizeEmail(memory.forPatient) === normalizedEmail
    );
    
    if (patientMemories.length > 0) {
      console.log(`Uploading ${patientMemories.length} memories for patient ${patientEmail}...`);
      
      // Send to server
      await axios.post(url, {
        caregiverId,
        patientEmail: normalizedEmail,
        memories: patientMemories
      }, { headers });
      
      return {
        success: true,
        count: patientMemories.length
      };
    }
    
    return {
      success: true,
      count: 0
    };
  } catch (error) {
    console.error('Error syncing caregiver memories:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync patient emergency contacts from caregiver
export const syncCaregiverContacts = async (caregiverId, patientEmail) => {
  try {
    console.log(`Syncing caregiver contacts for patient: ${patientEmail}...`);
    const url = `${getActiveServerUrl()}/api/caregivers/sync/patient-contacts`;
    const headers = await getCaregiverAuthHeaders();
    const normalizedEmail = normalizeEmail(patientEmail);
    
    // Get caregiver contacts for this patient
    const caregiverContactsKey = `emergencyContacts_${caregiverId}`;
    const allCaregiverContactsStr = await AsyncStorage.getItem(caregiverContactsKey);
    const allCaregiverContacts = allCaregiverContactsStr ? JSON.parse(allCaregiverContactsStr) : [];
    
    // Filter for this patient only
    const patientContacts = allCaregiverContacts.filter(contact => 
      contact && 
      contact.forPatient && 
      normalizeEmail(contact.forPatient) === normalizedEmail
    );
    
    if (patientContacts.length > 0) {
      console.log(`Uploading ${patientContacts.length} contacts for patient ${patientEmail}...`);
      
      // Send to server
      await axios.post(url, {
        caregiverId,
        patientEmail: normalizedEmail,
        contacts: patientContacts
      }, { headers });
      
      return {
        success: true,
        count: patientContacts.length
      };
    }
    
    return {
      success: true,
      count: 0
    };
  } catch (error) {
    console.error('Error syncing caregiver contacts:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync caregiver profile data with server
export const syncCaregiverProfile = async (caregiverId) => {
  try {
    console.log(`Syncing profile data for caregiver: ${caregiverId}...`);
    const url = `${getActiveServerUrl()}/api/caregivers/sync/profile`;
    const headers = await getCaregiverAuthHeaders();
    
    // Get caregiver data from storage
    const caregiverData = await AsyncStorage.getItem('caregiverData');
    if (!caregiverData) {
      console.log('No local caregiver data to sync');
      return { success: false };
    }
    
    const caregiverDataObj = JSON.parse(caregiverData);
    
    // Profile data to sync (don't include sensitive info)
    const profileData = {
      name: caregiverDataObj.name,
      phone: caregiverDataObj.phone || '',
      profileImageUrl: caregiverDataObj.profileImage || null
    };
    
    // Send profile data to server
    console.log('Uploading caregiver profile data to server...');
    await axios.post(url, { profile: profileData }, { headers });
    
    // Get latest profile data from server
    const response = await axios.get(`${getActiveServerUrl()}/api/caregivers/profile`, { headers });
    
    if (response.data && response.data.success) {
      console.log('Received updated caregiver profile data from server');
      
      // Update local caregiver data with server data
      const serverProfile = response.data.data;
      
      // Merge with existing data
      const updatedCaregiverData = {
        ...caregiverDataObj,
        name: serverProfile.name || caregiverDataObj.name,
        phone: serverProfile.phone || caregiverDataObj.phone || '',
        profileImage: serverProfile.profileImage || caregiverDataObj.profileImage,
        lastSync: new Date().toISOString()
      };
      
      // Save updated data back to local storage
      await AsyncStorage.setItem('caregiverData', JSON.stringify(updatedCaregiverData));
      
      return {
        success: true,
        profile: serverProfile
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error syncing caregiver profile:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get all patient data from server
export const getPatientData = async (caregiverId, patientEmail) => {
  try {
    console.log(`Getting all patient data for: ${patientEmail}...`);
    const normalizedEmail = normalizeEmail(patientEmail);
    const url = `${getActiveServerUrl()}/api/caregivers/sync/patient-data/${normalizedEmail}?caregiverId=${caregiverId}`;
    const headers = await getCaregiverAuthHeaders();
    
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.success) {
      console.log('Successfully retrieved patient data from server');
      return {
        success: true,
        data: response.data.patientData
      };
    }
    
    return {
      success: false,
      error: 'Failed to get patient data'
    };
  } catch (error) {
    console.error('Error getting patient data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync all user data with server (comprehensive sync)
export const syncAllUserData = async (userEmail) => {
  try {
    const normalizedEmail = normalizeEmail(userEmail);
    const syncKey = `all_data_${normalizedEmail}`;
    
    // Apply throttling
    if (shouldThrottleSync(syncKey)) {
      console.log(`Full data sync throttled for ${normalizedEmail}`);
      return { 
        success: true, 
        source: 'cache',
        throttled: true 
      };
    }
    
    console.log(`Starting comprehensive data fetch from database for user: ${userEmail}`);
    
    if (!isValidEmail(normalizedEmail)) {
      console.error(`Invalid email format: ${normalizedEmail}`);
      return { 
        success: false, 
        error: 'Invalid email format' 
      };
    }
    
    // Check server availability first
    let serverAvailable = false;
    let serverUrl = '';
    try {
      serverUrl = await getActiveServerUrl();
      const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
      serverAvailable = pingResponse.status === 200;
      console.log(`Server availability for data sync: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
    } catch (pingError) {
      console.log(`Server unavailable: ${pingError.message}`);
      serverAvailable = false;
    }
    
    // If server is not available, use local cache
    if (!serverAvailable) {
      console.log(`Server unavailable - using cached data for ${normalizedEmail}`);
      
      // Get from local storage as fallback
      const userDataKey = `userData_${normalizedEmail}`;
      const storedUserData = await AsyncStorage.getItem(userDataKey);
      
      if (storedUserData) {
        try {
          const userData = JSON.parse(storedUserData);
          console.log(`Using local cached data for: ${userData.name || normalizedEmail}`);
          return { 
            success: true, 
            source: 'local_fallback',
            offline: true,
            userData
          };
        } catch (parseError) {
          console.error(`Error parsing cached user data: ${parseError.message}`);
        }
      }
      
      return { 
        success: false, 
        error: 'No user data available offline', 
        offline: true 
      };
    }
    
    // SERVER IS AVAILABLE - fetch comprehensive data from database
    console.log(`Fetching comprehensive data from database for: ${normalizedEmail}`);
    
    // Headers for API calls
    const headers = await getAuthHeaders();
    
    // First, try to get user profile from server
    try {
      const profileEndpoint = `${serverUrl}/api/user/sync/email/${normalizedEmail}`;
      const profileResponse = await axios.get(profileEndpoint, { headers, timeout: 10000 });
      
      if (profileResponse.data && profileResponse.data.success && profileResponse.data.user) {
        const userData = profileResponse.data.user;
        console.log(`Retrieved user profile from database: ${userData.name || normalizedEmail}`);
        
        // Use this as the base user data to enhance with additional data
        
        // Step 2: Fetch all the additional data components
        const results = {};
        
        // Sync profile - already done
        results.profile = { success: true, source: 'server' };
        
        // Sync reminders
        console.log('Fetching user reminders from database...');
        try {
          const remindersEndpoint = `${serverUrl}/api/user/sync/reminders/${normalizedEmail}`;
          const remindersResponse = await axios.get(remindersEndpoint, { headers, timeout: 8000 });
          
          if (remindersResponse.data && remindersResponse.data.reminders) {
            const reminders = remindersResponse.data.reminders;
            console.log(`Retrieved ${reminders.length} reminders from database`);
            
            // Store in local storage for offline access
            await AsyncStorage.setItem(`reminders_${normalizedEmail}`, JSON.stringify(reminders));
            
            results.reminders = { success: true, source: 'server', count: reminders.length };
            userData.reminders = reminders;
          }
        } catch (remindersError) {
          console.log(`Error fetching reminders: ${remindersError.message}`);
          // Try to get from local storage
          try {
            const localReminders = await AsyncStorage.getItem(`reminders_${normalizedEmail}`);
            if (localReminders) {
              userData.reminders = JSON.parse(localReminders);
              results.reminders = { success: true, source: 'local_fallback' };
            }
          } catch (localError) {
            console.log(`Error getting local reminders: ${localError.message}`);
          }
        }
        
        // Similar pattern for other data types...
        
        // Save the complete user data to local storage for offline access
        console.log(`Saving complete user data to local cache for offline access: ${normalizedEmail}`);
        await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userData));
        await AsyncStorage.setItem(`lastSyncTime_${normalizedEmail}`, new Date().toISOString());
        
        return {
          success: true,
          source: 'server',
          results,
          userData
        };
      }
    } catch (profileError) {
      console.log(`Error fetching user profile: ${profileError.message}`);
    }
    
    // If we get here, we failed to get the profile from the server
    // Fall back to local storage
    console.log(`Failed to get user data from database, using local cache as fallback: ${normalizedEmail}`);
    
    const userDataKey = `userData_${normalizedEmail}`;
    const storedUserData = await AsyncStorage.getItem(userDataKey);
    
    if (storedUserData) {
      try {
        const userData = JSON.parse(storedUserData);
        console.log(`Using local cached data for: ${userData.name || normalizedEmail}`);
        return { 
          success: true, 
          source: 'local_fallback',
          userData
        };
      } catch (parseError) {
        console.error(`Error parsing cached user data: ${parseError.message}`);
      }
    }
    
    return { 
      success: false, 
      error: 'Failed to get user data from server and no local cache available'
    };
    
  } catch (error) {
    console.error(`Error in comprehensive data sync: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Sync patient profile data to caregiver with server-based storage
export const syncPatientProfileToCaregiver = async (patientEmail, caregiverEmail) => {
  try {
    // Normalize emails
    const normalizedPatientEmail = normalizeEmail(patientEmail);
    const normalizedCaregiverEmail = normalizeEmail(caregiverEmail);
    
    // Apply throttling for patient-caregiver sync
    const syncKey = `patient_caregiver_${normalizedPatientEmail}_${normalizedCaregiverEmail}`;
    if (shouldThrottleSync(syncKey)) {
      console.log(`Patient-caregiver sync throttled for ${normalizedPatientEmail} to ${normalizedCaregiverEmail}`);
      return { 
        success: true, 
        throttled: true 
      };
    }
    
    console.log(`Syncing patient profile from ${patientEmail} to caregiver ${caregiverEmail}`);
    
    if (!isValidEmail(normalizedPatientEmail) || !isValidEmail(normalizedCaregiverEmail)) {
      console.error('Invalid email format for patient or caregiver');
      return { success: false, error: 'Invalid email format' };
    }
    
    // First, check if the server connection is available
    let serverAvailable = false;
    
    try {
      const pingResponse = await axios.get(`${await getActiveServerUrl()}/api/ping`, { timeout: 3000 });
      serverAvailable = pingResponse.status === 200;
    } catch (pingError) {
      console.log('Server unreachable, will use local data only');
    }
    
    if (serverAvailable) {
      try {
        // Use server API to get patient data
        const headers = await getCaregiverAuthHeaders();
        const patientDataEndpoint = `${await getActiveServerUrl()}/api/user/patient/${normalizedPatientEmail}`;
        
        const response = await axios.get(patientDataEndpoint, { headers, timeout: 5000 });
        
        if (response.data && response.data.success && response.data.patient) {
          const patientData = response.data.patient;
          
          // Find the caregiver data
          const caregiverDataKey = `caregiverData_${normalizedCaregiverEmail}`;
          const storedCaregiverData = await AsyncStorage.getItem(caregiverDataKey);
          
          if (storedCaregiverData) {
            const caregiverData = JSON.parse(storedCaregiverData);
            
            // Update caregiver's local patient data
            if (!caregiverData.patientData) {
              caregiverData.patientData = {};
            }
            
            caregiverData.patientData[normalizedPatientEmail] = {
              name: patientData.name,
              email: patientData.email,
              profileImage: patientData.profileImage,
              reminders: patientData.reminders || [],
              memories: patientData.memories || [],
              emergencyContacts: patientData.emergencyContacts || [],
              homeLocation: patientData.homeLocation || null,
              lastSync: new Date().toISOString()
            };
            
            // Add to connected patients list if not already there
            if (!caregiverData.connectedPatients) {
              caregiverData.connectedPatients = [];
            }
            
            if (!caregiverData.connectedPatients.includes(normalizedPatientEmail)) {
              caregiverData.connectedPatients.push(normalizedPatientEmail);
            }
            
            // Update the primary patient if not set
            if (!caregiverData.patientEmail) {
              caregiverData.patientEmail = normalizedPatientEmail;
            }
            
            // Save updated caregiver data
            await AsyncStorage.setItem(caregiverDataKey, JSON.stringify(caregiverData));
            console.log(`Synced patient data to caregiver via server API: ${normalizedPatientEmail} → ${normalizedCaregiverEmail}`);
            
            return { 
              success: true,
              source: 'server'
            };
          }
        }
      } catch (serverApiError) {
        console.log(`Server API error, falling back to local sync: ${serverApiError.message}`);
        // Continue to local sync if server API fails
      }
    }
    
    // Local data sync as fallback
    console.log('Using local data sync as fallback');
    
    // Get patient data from AsyncStorage
    const patientDataKey = `userData_${normalizedPatientEmail}`;
    const storedPatientData = await AsyncStorage.getItem(patientDataKey);
    
    if (!storedPatientData) {
      console.error(`No patient data found for: ${normalizedPatientEmail}`);
      return { success: false, error: 'Patient data not found' };
    }
    
    const patientData = JSON.parse(storedPatientData);
    
    // Get patient's reminders, memories, and contacts
    const remindersKey = `reminders_${normalizedPatientEmail}`;
    const memoriesKey = `memories_${normalizedPatientEmail}`;
    const contactsKey = `emergencyContacts_${normalizedPatientEmail}`;
    
    const remindersStr = await AsyncStorage.getItem(remindersKey);
    const memoriesStr = await AsyncStorage.getItem(memoriesKey);
    const contactsStr = await AsyncStorage.getItem(contactsKey);
    
    const reminders = remindersStr ? JSON.parse(remindersStr) : [];
    const memories = memoriesStr ? JSON.parse(memoriesStr) : [];
    const contacts = contactsStr ? JSON.parse(contactsStr) : [];
    
    // Get caregiver data
    const caregiverDataKey = `caregiverData_${normalizedCaregiverEmail}`;
    const storedCaregiverData = await AsyncStorage.getItem(caregiverDataKey);
    
    if (!storedCaregiverData) {
      console.error(`No caregiver data found for: ${normalizedCaregiverEmail}`);
      return { success: false, error: 'Caregiver data not found' };
    }
    
    const caregiverData = JSON.parse(storedCaregiverData);
    
    // Add patient data to caregiver's patientData
    if (!caregiverData.patientData) {
      caregiverData.patientData = {};
    }
    
    caregiverData.patientData[normalizedPatientEmail] = {
      name: patientData.name,
      email: patientData.email,
      profileImage: patientData.profileImage,
      reminders: reminders,
      memories: memories,
      emergencyContacts: contacts,
      homeLocation: patientData.homeLocation || null,
      lastSync: new Date().toISOString()
    };
    
    // Add to connected patients if not already there
    if (!caregiverData.connectedPatients) {
      caregiverData.connectedPatients = [];
    }
    
    if (!caregiverData.connectedPatients.includes(normalizedPatientEmail)) {
      caregiverData.connectedPatients.push(normalizedPatientEmail);
    }
    
    // Update the primary patient if not set
    if (!caregiverData.patientEmail) {
      caregiverData.patientEmail = normalizedPatientEmail;
    }
    
    // Save updated caregiver data
    await AsyncStorage.setItem(caregiverDataKey, JSON.stringify(caregiverData));
    console.log(`Synced patient data to caregiver locally: ${normalizedPatientEmail} → ${normalizedCaregiverEmail}`);
    
    // Update the caregiverPatientsMap to maintain relationship
    const mappingKey = 'caregiverPatientsMap';
    const mappingStr = await AsyncStorage.getItem(mappingKey) || '{}';
    const mappings = JSON.parse(mappingStr);
    
    // Add patient to caregiver mapping
    const caregiverKey = `caregiver_${normalizedCaregiverEmail}`;
    if (!mappings[caregiverKey] || !Array.isArray(mappings[caregiverKey])) {
      mappings[caregiverKey] = [];
    }
    
    if (!mappings[caregiverKey].includes(normalizedPatientEmail)) {
      mappings[caregiverKey].push(normalizedPatientEmail);
    }
    
    // Add caregiver to patient mapping
    mappings[normalizedPatientEmail] = normalizedCaregiverEmail;
    
    // Save updated mappings
    await AsyncStorage.setItem(mappingKey, JSON.stringify(mappings));
    
    return { 
      success: true,
      source: 'local'
    };
  } catch (error) {
    console.error('Error syncing patient profile to caregiver:', error);
    return { success: false, error: error.message };
  }
};

// Process any pending profile sync operations
export const processPendingProfileSyncs = async () => {
  try {
    // Avoid starting if another sync is already in progress
    if (globalSyncInProgress) {
      console.log('Another sync operation is already in progress, skipping pending syncs');
      return { success: false, error: 'Sync already in progress' };
    }
    
    // Check for internet connectivity first
    try {
      await axios.get(`${getActiveServerUrl()}/ping`, { timeout: 3000 });
    } catch (error) {
      console.log('No internet connection for pending syncs, will try later');
      return { success: false, error: 'No internet connection' };
    }
    
    // Set global sync lock
    if (!acquireSyncLock()) {
      return { success: false, error: 'Another sync already in progress' };
    }
    
    try {
      console.log('Processing pending profile synchronizations...');
      
      // Get the list of pending syncs
      const pendingSyncsStr = await AsyncStorage.getItem('pendingProfileSyncs') || '[]';
      let pendingSyncs;
      
      try {
        pendingSyncs = JSON.parse(pendingSyncsStr);
      } catch (parseError) {
        console.log('Error parsing pending syncs, resetting:', parseError.message);
        await AsyncStorage.setItem('pendingProfileSyncs', '[]');
        releaseSyncLock();
        return { success: false, error: 'Invalid pending syncs data' };
      }
      
      if (!pendingSyncs.length) {
        console.log('No pending profile syncs to process');
        releaseSyncLock();
        return { success: true, synced: 0 };
      }
      
      console.log(`Found ${pendingSyncs.length} pending profile syncs to process`);
      const successfulSyncs = [];
      
      // Process each pending sync
      for (const sync of pendingSyncs) {
        try {
          const { email, profileData } = sync;
          
          if (!email || !profileData) {
            console.log('Skipping invalid sync entry', sync);
            continue;
          }
          
          console.log(`Processing pending sync for ${email}`);
          
          // Try to sync using all available endpoints
          const serverUrl = getActiveServerUrl();
          
          // First try the update endpoint
          try {
            const updateResponse = await axios.post(`${serverUrl}/api/users/update`, profileData, {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (updateResponse.data && updateResponse.data.success) {
              console.log(`Successfully synced profile for ${email}`);
              successfulSyncs.push(email);
              continue;
            }
          } catch (updateError) {
            console.log(`Update endpoint failed for ${email}:`, updateError.message);
          }
          
          // Try the create endpoint next
          try {
            const createResponse = await axios.post(`${serverUrl}/api/users/profile`, profileData, {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (createResponse.data && createResponse.data.success) {
              console.log(`Successfully created profile for ${email}`);
              successfulSyncs.push(email);
              continue;
            }
          } catch (createError) {
            console.log(`Create endpoint failed for ${email}:`, createError.message);
          }
          
          // Try the register endpoint as last resort
          try {
            const registerResponse = await axios.post(`${serverUrl}/api/auth/register`, {
              ...profileData,
              email: email,
              password: profileData.password || 'defaultPassword123'
            }, {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (registerResponse.data && (registerResponse.data.success || registerResponse.data.token)) {
              console.log(`Successfully registered profile for ${email}`);
              successfulSyncs.push(email);
              continue;
            }
          } catch (registerError) {
            console.log(`Register endpoint failed for ${email}:`, registerError.message);
          }
          
          console.log(`All sync attempts failed for ${email}, will retry later`);
        } catch (syncError) {
          console.error('Error processing sync item:', syncError.message);
        }
      }
      
      // Remove successful syncs from the pending list
      if (successfulSyncs.length > 0) {
        const remainingSyncs = pendingSyncs.filter(sync => !successfulSyncs.includes(sync.email));
        await AsyncStorage.setItem('pendingProfileSyncs', JSON.stringify(remainingSyncs));
        console.log(`Removed ${successfulSyncs.length} successful syncs, ${remainingSyncs.length} remaining`);
      }
      
      // Release lock before returning
      releaseSyncLock();
      return {
        success: true,
        synced: successfulSyncs.length,
        remaining: pendingSyncs.length - successfulSyncs.length
      };
    } catch (error) {
      releaseSyncLock(); // Ensure lock is released on error
      throw error;
    }
  } catch (error) {
    console.error('Error processing pending profile syncs:', error);
    releaseSyncLock(); // Ensure lock is released on error
    return { success: false, error: error.message };
  }
};

// New function to fetch patient name directly from backend database
export const fetchPatientNameFromBackend = async (patientEmail) => {
  try {
    console.log(`Fetching patient name from backend for: ${patientEmail}`);
    if (!patientEmail) {
      console.log('No email provided, cannot fetch patient name');
      return { success: false, error: 'Email required' };
    }
    
    if (!isValidEmail(patientEmail)) {
      console.log(`Invalid email format: ${patientEmail}`);
      return { success: false, error: 'Invalid email format' };
    }
    
    const normalizedEmail = normalizeEmail(patientEmail);
    let backendName = null;
    let responseSuccess = false;
    
    // Get the active server URL
    const serverUrl = await getActiveServerUrl();
    if (!serverUrl) {
      console.log('No server URL available');
      return { success: false, error: 'No server URL available' };
    }
    
    console.log(`Using server URL: ${serverUrl}`);
    
    // Try multiple endpoints in parallel for better chances of success
    const endpoints = [
      `/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
      `/api/users/lookup?email=${encodeURIComponent(normalizedEmail)}`,
      `/api/users/details?email=${encodeURIComponent(normalizedEmail)}`,
      `/api/patients/profile?email=${encodeURIComponent(normalizedEmail)}`,
      `/api/patients/${encodeURIComponent(normalizedEmail)}`
    ];
    
    // Create all the promises for parallel execution
    const fetchPromises = endpoints.map(endpoint => 
      axios.get(`${serverUrl}${endpoint}`, { timeout: 5000 })
        .catch(err => {
          console.log(`Endpoint ${endpoint} failed: ${err.message}`);
          return { data: null };
        })
    );
    
    // Execute all requests in parallel
    console.log(`Trying ${endpoints.length} backend endpoints...`);
    const results = await Promise.all(fetchPromises);
    
    // Process results in priority order
    for (let i = 0; i < results.length; i++) {
      const response = results[i];
      if (response && response.data) {
        // Different endpoints might have different response structures
        if (response.data.name) {
          console.log(`Found name in endpoint ${endpoints[i]}: ${response.data.name}`);
          backendName = response.data.name;
          responseSuccess = true;
          break;
        } else if (response.data.data && response.data.data.name) {
          console.log(`Found name in endpoint ${endpoints[i]}: ${response.data.data.name}`);
          backendName = response.data.data.name;
          responseSuccess = true;
          break;
        } else if (response.data.user && response.data.user.name) {
          console.log(`Found name in endpoint ${endpoints[i]}: ${response.data.user.name}`);
          backendName = response.data.user.name;
          responseSuccess = true;
          break;
        } else if (response.data.patient && response.data.patient.name) {
          console.log(`Found name in endpoint ${endpoints[i]}: ${response.data.patient.name}`);
          backendName = response.data.patient.name;
          responseSuccess = true;
          break;
        } else if (response.data.profile && response.data.profile.name) {
          console.log(`Found name in endpoint ${endpoints[i]}: ${response.data.profile.name}`);
          backendName = response.data.profile.name;
          responseSuccess = true;
          break;
        }
      }
    }
    
    // If we found a name from the backend
    if (responseSuccess && backendName) {
      console.log(`Successfully retrieved patient name from backend: ${backendName}`);
      
      // Optionally update local storage with this name
      try {
        const userData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
        if (userData) {
          const userDataObj = JSON.parse(userData);
          if (userDataObj.name !== backendName) {
            console.log(`Updating local storage with backend name: ${backendName}`);
            userDataObj.name = backendName;
            await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userDataObj));
          }
        }
      } catch (storageError) {
        console.log(`Error updating local storage: ${storageError.message}`);
      }
      
      return {
        success: true,
        name: backendName,
        source: 'backend'
      };
    }
    
    // If backend failed, try to get from local storage as fallback
    console.log('Failed to get name from backend, checking local storage');
    
    try {
      const userData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
      if (userData) {
        const userDataObj = JSON.parse(userData);
        if (userDataObj.name) {
          console.log(`Found name in local storage: ${userDataObj.name}`);
          return {
            success: true,
            name: userDataObj.name,
            source: 'local_storage'
          };
        }
      }
    } catch (storageError) {
      console.log(`Error checking local storage: ${storageError.message}`);
    }
    
    // Last resort - derive from email
    const derivedName = normalizedEmail.split('@')[0]
      .split(/[.\-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    console.log(`No name found in backend or local storage, derived: ${derivedName}`);
    return {
      success: true,
      name: derivedName,
      source: 'derived'
    };
  } catch (error) {
    console.error(`Error fetching patient name from backend: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Add this new diagnostic function after fetchPatientNameFromBackend
export const diagnosticGetAllPatientNames = async (patientEmail) => {
  try {
    console.log(`DIAGNOSTIC: Getting ALL possible names for patient: ${patientEmail}`);
    if (!patientEmail) {
      return { success: false, error: 'Email required for diagnosis' };
    }
    
    const normalizedEmail = normalizeEmail(patientEmail);
    const allNames = {};
    
    // Check ALL AsyncStorage keys
    console.log(`\n===== CHECKING ALL ASYNC STORAGE KEYS FOR ${normalizedEmail} =====`);
    
    // Get all keys in AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Found ${allKeys.length} total AsyncStorage keys`);
    
    // Find relevant keys for this user
    const relevantKeys = allKeys.filter(key => 
      key.includes(normalizedEmail) || 
      (key.includes('userData_') || key.includes('patientData_') || 
       key.includes('directPatientData_') || key.includes('syncedUserData_') ||
       key.includes('userProfile_') || key.includes('backupUserData_') || 
       key.includes('connectedPatients_') || key.includes('activePatient_'))
    );
    
    console.log(`Found ${relevantKeys.length} keys potentially related to this patient`);
    
    // Check each key for a name
    for (const key of relevantKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (!data) continue;
        
        // Try to parse the data
        try {
          const parsed = JSON.parse(data);
          
          // Different data structures require different checks
          if (Array.isArray(parsed)) {
            // If it's an array, look for the patient
            const patientInArray = parsed.find(item => {
              if (!item || typeof item !== 'object') return false;
              return item.email && normalizeEmail(item.email) === normalizedEmail;
            });
            
            if (patientInArray && patientInArray.name) {
              console.log(`${key}: "${patientInArray.name}" (in array)`);
              allNames[key] = patientInArray.name;
            }
          } 
          // For single objects
          else if (parsed && typeof parsed === 'object') {
            // Direct name check
            if (parsed.name) {
              // If this is definitely about the right patient
              if (!parsed.email || normalizeEmail(parsed.email) === normalizedEmail) {
                console.log(`${key}: "${parsed.name}"`);
                allNames[key] = parsed.name;
              }
            }
            
            // Check if there's a patient map or structure
            if (parsed[normalizedEmail]) {
              if (typeof parsed[normalizedEmail] === 'string') {
                console.log(`${key}: Maps to "${parsed[normalizedEmail]}"`);
                allNames[`${key}[map]`] = parsed[normalizedEmail];
              } else if (typeof parsed[normalizedEmail] === 'object' && parsed[normalizedEmail].name) {
                console.log(`${key}: "${parsed[normalizedEmail].name}" (in object)`);
                allNames[`${key}[nested]`] = parsed[normalizedEmail].name;
              }
            }
            
            // Check caregiver-specific storage patterns
            if (parsed.patients && Array.isArray(parsed.patients)) {
              const patientInCGList = parsed.patients.find(p => 
                p.email && normalizeEmail(p.email) === normalizedEmail);
              
              if (patientInCGList && patientInCGList.name) {
                console.log(`${key}: "${patientInCGList.name}" (in caregiver's patient list)`);
                allNames[`${key}[cgList]`] = patientInCGList.name;
              }
            }
          }
        } catch (parseError) {
          console.log(`${key}: Failed to parse JSON`);
        }
      } catch (error) {
        console.log(`${key}: Error accessing data - ${error.message}`);
      }
    }
    
    // Try to fetch from active server
    try {
      console.log(`\n===== CHECKING SERVER ENDPOINTS =====`);
      const serverUrl = await getActiveServerUrl();
      
      if (serverUrl) {
        console.log(`Using server URL: ${serverUrl}`);
        
        const endpoints = [
          `/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
          `/api/users/lookup?email=${encodeURIComponent(normalizedEmail)}`,
          `/api/users/${encodeURIComponent(normalizedEmail)}`,
          `/api/patients/profile?email=${encodeURIComponent(normalizedEmail)}`,
          `/api/patients/${encodeURIComponent(normalizedEmail)}`
        ];
        
        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);
            const response = await axios.get(`${serverUrl}${endpoint}`, { timeout: 3000 });
            
            if (response.data) {
              // Try various response formats
              let name = null;
              
              if (response.data.name) {
                name = response.data.name;
              } else if (response.data.data && response.data.data.name) {
                name = response.data.data.name;
              } else if (response.data.user && response.data.user.name) {
                name = response.data.user.name;
              } else if (response.data.patient && response.data.patient.name) {
                name = response.data.patient.name;
              } else if (response.data.profile && response.data.profile.name) {
                name = response.data.profile.name;
              }
              
              if (name) {
                console.log(`Server ${endpoint}: "${name}"`);
                allNames[`server${endpoint}`] = name;
              } else {
                console.log(`Server ${endpoint}: No name found in response`);
              }
            }
          } catch (endpointError) {
            console.log(`Server ${endpoint}: ${endpointError.message}`);
          }
        }
      } else {
        console.log("No server URL available");
      }
    } catch (serverError) {
      console.log(`Server error: ${serverError.message}`);
    }
    
    // Check current app memory state
    try {
      console.log(`\n===== CHECKING FOR ACTIVE PATIENT =====`);
      
      // Find caregiver keys
      const caregiverKeys = allKeys.filter(key => key.startsWith('userData_') && key !== `userData_${normalizedEmail}`);
      
      for (const cgKey of caregiverKeys) {
        const caregiverEmail = cgKey.replace('userData_', '');
        const activePatientKey = `activePatient_${caregiverEmail}`;
        
        try {
          const activePatientData = await AsyncStorage.getItem(activePatientKey);
          if (activePatientData) {
            const activePatient = JSON.parse(activePatientData);
            if (activePatient && activePatient.email && normalizeEmail(activePatient.email) === normalizedEmail) {
              console.log(`Active patient for caregiver ${caregiverEmail}: "${activePatient.name}"`);
              allNames[`activePatient:${caregiverEmail}`] = activePatient.name;
            }
          }
        } catch (error) {
          console.log(`Error checking active patient for ${caregiverEmail}`);
        }
      }
    } catch (error) {
      console.log(`Error checking active patients: ${error.message}`);
    }
    
    // Check UserContext's currentUser
    try {
      console.log(`\n===== CHECKING CURRENT APP STATE =====`);
      const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
      console.log(`Current user email: ${currentUserEmail}`);
      
      if (currentUserEmail === normalizedEmail) {
        console.log(`This patient is the current user`);
      }
    } catch (error) {
      console.log(`Error checking current user: ${error.message}`);
    }
    
    return {
      success: true,
      email: normalizedEmail,
      allPossibleNames: allNames,
      nameCount: Object.keys(allNames).length
    };
  } catch (error) {
    console.error(`Diagnostic error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Synchronize caregiver's connected patients from server
export const syncCaregiverPatients = async (caregiverEmail, caregiverId) => {
  if (!caregiverEmail || !caregiverId) {
    console.log("Missing required parameters for syncCaregiverPatients");
    return { success: false, message: "Missing required parameters" };
  }

  // Normalize the email
  const normalizedEmail = normalizeEmail(caregiverEmail);
  
  // Generate a unique key for throttling
  const syncKey = `caregiverPatients_${normalizedEmail}`;
  
  // Check if we should throttle this sync request
  if (shouldThrottleSync(syncKey)) {
    return { 
      success: false, 
      throttled: true,
      message: "Sync throttled - recent attempt" 
    };
  }
  
  console.log(`==== SYNCHRONIZING CONNECTED PATIENTS FOR CAREGIVER: ${normalizedEmail} ====`);
  
  try {
    // First check server connectivity
    let serverAvailable = false;
    let serverUrl = '';
    try {
      serverUrl = getActiveServerUrl();
      const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
      serverAvailable = pingResponse.status === 200;
      console.log(`Server availability for patient sync: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
    } catch (error) {
      console.log(`Server unavailable for patient sync: ${error.message}`);
      serverAvailable = false;
    }
    
    // If server is available, try to fetch connected patients from server
    if (serverAvailable) {
      try {
        // First load local patients as a fallback
        const patientsKey = `connectedPatients_${normalizedEmail}`;
        const storedPatients = await AsyncStorage.getItem(patientsKey);
        let localPatients = storedPatients ? JSON.parse(storedPatients) : [];
        
        console.log(`Found ${localPatients.length} locally stored patients for fallback`);
        
        // Try to get the latest patients from server
        console.log(`Fetching connected patients from server for caregiver: ${normalizedEmail}`);
        const response = await axios.get(
          `${serverUrl}/api/caregivers/${caregiverId}/patients`, 
          { 
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        if (response.data && response.data.success && response.data.patients) {
          const serverPatients = response.data.patients;
          console.log(`Server returned ${serverPatients.length} connected patients`);
          
          // Process server patients to ensure they have all required fields
          const processedPatients = await Promise.all(serverPatients.map(async (patient) => {
            // Ensure we have the most complete patient data
            const existingPatient = localPatients.find(p => 
              normalizeEmail(p.email) === normalizeEmail(patient.email)
            );
            
            // If we have existing patient data locally, merge with server data
            if (existingPatient) {
              console.log(`Merging server and local data for patient: ${patient.email}`);
              return {
                ...existingPatient,
                id: patient.id || existingPatient.id || `patient_${Date.now()}`,
                name: patient.name || existingPatient.name || "Patient",
                email: normalizeEmail(patient.email),
                profileImage: patient.profileImage || existingPatient.profileImage,
                // Copy any other fields we want to preserve
                updatedAt: new Date().toISOString()
              };
            }
            
            // For new patients, ensure we have all required fields
            return {
              id: patient.id || `patient_${Date.now()}`,
              name: patient.name || "Patient",
              email: normalizeEmail(patient.email),
              profileImage: patient.profileImage || null,
              image: patient.profileImage || null,
              updatedAt: new Date().toISOString()
            };
          }));
          
          // Update AsyncStorage with the synced patients
          await AsyncStorage.setItem(patientsKey, JSON.stringify(processedPatients));
          console.log(`Updated local storage with ${processedPatients.length} patients from server`);
          
          // Also update the specific patient data for each patient
          for (const patient of processedPatients) {
            const patientEmail = normalizeEmail(patient.email);
            
            // Update the patient data in direct storage for quicker access
            const patientDataKey = `directPatientData_${patientEmail}`;
            await AsyncStorage.setItem(patientDataKey, JSON.stringify(patient));
            
            console.log(`Updated direct patient data for: ${patient.name || patientEmail}`);
          }
          
          return {
            success: true,
            patients: processedPatients,
            source: 'server',
            message: 'Successfully synchronized patients from server'
          };
        } else {
          console.log("Server response didn't contain valid patients data");
          // Fall back to local data
          return {
            success: true,
            patients: localPatients,
            source: 'local',
            message: 'Using local patients data (server response invalid)'
          };
        }
      } catch (serverError) {
        console.log(`Error fetching patients from server: ${serverError.message}`);
        
        // Fall back to local data on server error
        const patientsKey = `connectedPatients_${normalizedEmail}`;
        const storedPatients = await AsyncStorage.getItem(patientsKey);
        const localPatients = storedPatients ? JSON.parse(storedPatients) : [];
        
        return {
          success: true,
          patients: localPatients,
          source: 'local',
          message: `Using local patients data (server error: ${serverError.message})`
        };
      }
    } else {
      // If server is not available, use local data
      const patientsKey = `connectedPatients_${normalizedEmail}`;
      const storedPatients = await AsyncStorage.getItem(patientsKey);
      const localPatients = storedPatients ? JSON.parse(storedPatients) : [];
      
      console.log(`Server unavailable, using ${localPatients.length} local patients`);
      
      return {
        success: true,
        patients: localPatients,
        source: 'local',
        message: 'Using local patients data (server unavailable)'
      };
    }
  } catch (error) {
    console.error(`Error in syncCaregiverPatients: ${error.message}`);
    
    // On any error, attempt to return local data
    try {
      const patientsKey = `connectedPatients_${normalizedEmail}`;
      const storedPatients = await AsyncStorage.getItem(patientsKey);
      const localPatients = storedPatients ? JSON.parse(storedPatients) : [];
      
      return {
        success: true,
        patients: localPatients,
        source: 'local',
        message: `Error in sync, using local patients (${error.message})`
      };
    } catch (localError) {
      return {
        success: false,
        patients: [],
        message: `Failed to sync patients and couldn't load local data (${error.message})`
      };
    }
  }
};

// Export all functions
export default {
  syncUserReminders,
  syncUserMemories,
  syncUserContacts,
  syncUserHomeLocation,
  syncUserProfile,
  syncCaregiverProfile,
  syncCaregiverReminders,
  syncCaregiverMemories,
  syncCaregiverContacts,
  getPatientData,
  syncAllUserData,
  processPendingProfileSyncs,
  syncCaregiverPatients
}; 