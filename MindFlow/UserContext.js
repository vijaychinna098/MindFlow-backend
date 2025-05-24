import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, DeviceEventEmitter } from 'react-native';

// Import FileSystem safely, with a try-catch block 
let FileSystem;
try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.log('FileSystem module could not be loaded:', error.message);
  FileSystem = null;
}

import axios from 'axios';
import { API_BASE_URL } from './config';
import { syncAllUserData, fetchPatientName, fetchPatientNameFromBackend, diagnosticGetAllPatientNames, syncUserProfile } from './services/ServerSyncService';
import { shareProfileDataDirectly, forceSyncPatientNameToCaregiver, forceSyncPatientDataToCaregiver, forceSyncPatientDataAndName, ensureConsistentUserNames } from './services/DataSynchronizationService';
import { cloudStoreUserProfile, cloudGetUserProfile, checkForRemoteUpdates, loginWithMongoDB, notifyProfileChange } from './services/DatabaseService';

const UserContext = createContext();

// Add timeout for network operations
const NETWORK_TIMEOUT = 5000; // 5 seconds

// Add timeout for loading state
const LOADING_TIMEOUT = 10000; // 10 seconds - prevent infinite loading

// Track failed sync attempts for retries
const syncAttempts = {};
const MAX_SYNC_ATTEMPTS = 3;

// Reduced sync intervals for better cross-device updates
const MIN_SYNC_TIME = 3000; // Reduced from 5s to 3s
const MIN_ENSURE_TIME = 2000; // Reduced from 3s to 2s
const REALTIME_SYNC_INTERVAL = 2000; // Reduced from 5s to 2s - Check for updates from other devices more frequently

// Add a flag to track if a manual sync is in progress
let manualSyncInProgress = false;

// Create a global event emitter for profile sync events
// const profileSyncEmitter = new EventEmitter();

const validateUserData = (data) => {
  if (!data?.email) throw new Error('Invalid user data');
  
  // Log the medical information that's coming in
  console.log("Validating medical info:", 
    JSON.stringify({
      conditions: data.medicalInfo?.conditions || '',
      medications: data.medicalInfo?.medications || '',
      allergies: data.medicalInfo?.allergies || '',
      bloodType: data.medicalInfo?.bloodType || ''
    })
  );
  
  return {
    id: data.id || '',
    name: data.name || '',
    email: data.email.toLowerCase(),
    token: data.token || '',
    profileImage: data.profileImage || null,
    phone: data.phone || '',
    address: data.address || '',
    age: data.age || '',
    medicalInfo: {
      conditions: data.medicalInfo?.conditions || '',
      medications: data.medicalInfo?.medications || '',
      allergies: data.medicalInfo?.allergies || '',
      bloodType: data.medicalInfo?.bloodType || '',
    },
    homeLocation: data.homeLocation || null,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
};

// Helper to check if an object has changed significantly
const hasProfileChanged = (oldData, newData) => {
  if (!oldData || !newData) return true;
  
  // Check essential fields
  if (oldData.name !== newData.name) return true;
  if (oldData.phone !== newData.phone) return true;
  if (oldData.address !== newData.address) return true;
  if (oldData.age !== newData.age) return true;
  if (oldData.profileImage !== newData.profileImage) return true;
  
  // Check medical info
  const oldMedical = oldData.medicalInfo || {};
  const newMedical = newData.medicalInfo || {};
  if (oldMedical.conditions !== newMedical.conditions) return true;
  if (oldMedical.medications !== newMedical.medications) return true;
  if (oldMedical.allergies !== newMedical.allergies) return true;
  if (oldMedical.bloodType !== newMedical.bloodType) return true;
  
  return false;
};

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState(null);

  // Add a ref to track app state
  const appState = useRef(AppState.currentState);
  // Add last sync timestamp ref
  const lastProfileSyncTime = useRef(0);

  // Ensure we don't get stuck in loading state
  useEffect(() => {
    // Set a timeout to exit loading state if it takes too long
    const loadingTimer = setTimeout(() => {
      if (isLoading) {
        console.log('Loading timeout reached - preventing infinite loading screen');
        setIsLoading(false);
      }
    }, LOADING_TIMEOUT);
    
    return () => clearTimeout(loadingTimer);
  }, [isLoading]);

  // Add a useEffect hook to check AsyncStorage for isUserSignedIn status on app load
  useEffect(() => {
    const checkSignInStatus = async () => {
      try {
        const storedSignInStatus = await AsyncStorage.getItem('isUserSignedIn');
        const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
        
        console.log('Checking stored sign-in status:', storedSignInStatus);
        console.log('Checking stored user email:', currentUserEmail);
        
        if (storedSignInStatus === 'true' && currentUserEmail) {
          console.log('Found stored sign-in state: SIGNED IN');
          setIsSignedIn(true);
          
          // Check for name and profile image consistency across devices
          await checkNameConsistency(currentUserEmail);
          await checkProfileImageConsistency(currentUserEmail);
          
          // If we don't already have a currentUser loaded, load it now
          if (!currentUser && !isLoading) {
            console.log('No current user loaded, loading from storage');
            loadUser();
          }
        } else {
          console.log('Found stored sign-in state: SIGNED OUT');
          setIsSignedIn(false);
        }
      } catch (error) {
        console.error('Error checking sign-in status:', error);
      }
    };
    
    checkSignInStatus();
  }, []);

  // Helper function to check and maintain name consistency across devices
  const checkNameConsistency = async (email) => {
    if (!email) return;
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const userDataKey = `userData_${normalizedEmail}`;
      const canonicalNameKey = `canonicalName_${normalizedEmail}`;
      
      // Get current user data and canonical name
      const userData = await AsyncStorage.getItem(userDataKey);
      const canonicalName = await AsyncStorage.getItem(canonicalNameKey);
      
      if (userData) {
        const parsedData = JSON.parse(userData);
        
        // If user has explicitly set a name and it differs from canonical name, update canonical name
        if (parsedData.name && (!canonicalName || parsedData.name !== canonicalName)) {
          console.log(`Name change detected! Updating canonical name to "${parsedData.name}"`);
          
          // Update canonical name with user's choice
          await AsyncStorage.setItem(canonicalNameKey, parsedData.name);
          
          // Queue an update to the server with the new name
          try {
            const { saveUserProfileToDB } = require('./services/DatabaseService');
            console.log('Sending new name to server for consistency');
            await saveUserProfileToDB({
              ...parsedData,
              updatedAt: new Date().toISOString(), // Add timestamp to mark as fresh update
            });
          } catch (serverError) {
            console.log(`Error updating server with new name: ${serverError.message}`);
          }
        } 
        // Only if current data has no name but we have a canonical name, use canonical
        else if (!parsedData.name && canonicalName) {
          console.log(`No name in current data, using canonical name: "${canonicalName}"`);
          
          parsedData.name = canonicalName;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(parsedData));
          
          // If this is the current user, update state
          if (currentUser && currentUser.email === normalizedEmail) {
            setCurrentUser({...currentUser, name: canonicalName});
          }
        }
      }
    } catch (error) {
      console.log(`Error checking name consistency: ${error.message}`);
    }
  };

  // Add an additional check that runs whenever the app gains focus
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      // When app comes to foreground, verify user data is intact
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('MONGODB: App came to foreground - checking for updates from other devices');
        
        if (isSignedIn && currentUser && currentUser.email) {
          try {
            // Force immediate sync when returning to the app
            console.log('MONGODB: Forcing immediate sync on app foreground');
            await forceImmediateSync();
        } catch (error) {
            console.log(`MONGODB: Error in foreground sync: ${error.message}`);
          }
        }
      }
      
      appState.current = nextAppState;
    };
    
    // Set up the app state change listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [appState, isSignedIn, currentUser, forceImmediateSync]);

  const getActiveServerUrl = async () => {
    try {
      // Try to use the configured URL from config.js
      if (API_BASE_URL) return API_BASE_URL;
      
      // Fall back to the default URL if available
      return "https://mindflow-backend-1vcl.onrender.com";
    } catch (error) {
      console.log("Error getting server URL:", error.message);
      return "https://mindflow-backend-1vcl.onrender.com";
    }
  };

  // Verify if a user account exists on the server
  const verifyUserExists = async (userId, token) => {
    try {
      console.log("Verifying user still exists on server...");
      
      // Get the current server URL
      const serverUrl = await getActiveServerUrl();
      
      // Try multiple verification endpoints for better reliability
      const endpoints = [
        `${serverUrl}/api/auth/verify-token`,
        `${serverUrl}/api/users/verify`,
        `${serverUrl}/api/auth/check-token`,
        `${serverUrl}/api/users/profile/verify`
      ];
      
      // Try each endpoint
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying verify endpoint: ${endpoint}`);
          const response = await axios.get(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            timeout: 5000 // 5 second timeout
          });
          
          if (response.data && response.data.success === true) {
            console.log("Account verification succeeded");
            return true;
          }
        } catch (endpointError) {
          console.log(`Endpoint ${endpoint} failed: ${endpointError.message}`);
          // Continue to next endpoint
        }
      }
      
      // If all direct verification attempts failed, try a simple endpoint to check if the server is reachable
      try {
        const pingResponse = await axios.get(`${serverUrl}/api/ping`, { timeout: 3000 });
        if (pingResponse.status === 200) {
          console.log("Server is reachable but token verification failed - assuming user exists but token expired");
          return true; // Assume user exists but token may have expired
        }
      } catch (pingError) {
        console.log("Server ping failed, network may be down");
      }
      
      // For network errors, we'll assume the user exists to prevent false negatives
      return true;
    } catch (error) {
      // Don't log the raw 401 error to console
      if (error.response && (error.response.status === 401 || error.response.status === 404)) {
        console.log("Account verification failed - user doesn't exist or token invalid");
      } else {
        console.log("User verification check failed - network or server error");
      }
      
      // For network errors, assume the user exists to prevent data loss
      if (!error.response) {
        console.log("Network error during verification, assuming user exists");
        return true;
      }
      
      // If we get a 401 or 404 response, the user doesn't exist
      if (error.response && (error.response.status === 401 || error.response.status === 404)) {
        return false;
      }
      // For network errors, we'll assume the user exists to prevent false negatives
      return true;
    }
  };

  // Clear local data for a specific user
  const clearUserData = async (email) => {
    try {
      const normalized = email.toLowerCase().trim();
      const userDataKey = `userData_${normalized}`;
      
      console.log(`Clearing local data for account: ${normalized}`);
      
      // Clear all related local storage items
      await AsyncStorage.removeItem(userDataKey);
      await AsyncStorage.removeItem(`userHasProfileImage_${normalized}`);
      await AsyncStorage.removeItem(`userProfileImagePath_${normalized}`);
      
      // If this was the current user, clear that too
      const currentEmail = await AsyncStorage.getItem("currentUserEmail");
      if (currentEmail === normalized) {
        await AsyncStorage.removeItem("currentUserEmail");
      }
      
      console.log(`Successfully cleared local data for account: ${normalized}`);
      return true;
    } catch (error) {
      console.error("Error clearing user data:", error);
      return false;
    }
  };

  // Improved function to load user from all sources using unified sync
  const loadUserFromAllSources = async (email) => {
    if (!email) return null;
    
    try {
      console.log(`Loading user data from database for: ${email}`);
      
      // Import the server sync service with unified sync
      const { unifiedSyncUserData } = require('./services/ServerSyncService');
      
      // First check if we have local data to compare with
      let localUserData = null;
      try {
        const userDataKey = `userData_${email.toLowerCase().trim()}`;
        const localData = await AsyncStorage.getItem(userDataKey);
        if (localData) {
          localUserData = JSON.parse(localData);
          console.log(`Found local data for: ${email} with profile image: ${localUserData.profileImage ? 'YES' : 'NO'}`);
        }
      } catch (localError) {
        console.log(`Error reading local data: ${localError.message}`);
      }
      
      // Use the unified sync to get the latest data
      try {
        console.log("Using unified sync to get latest user data...");
        const syncResult = await unifiedSyncUserData(email);
      
        if (syncResult.success && syncResult.user) {
          console.log(`Successfully loaded profile using unified sync for: ${syncResult.user.name || email}`);
          lastProfileSyncTime.current = Date.now();
          return syncResult.user;
        } else if (syncResult.user) {
          // We have user data from the sync function, even though there were issues
          console.log(`Sync had issues but returned user data: ${syncResult.error || 'Unknown error'}`);
          lastProfileSyncTime.current = Date.now();
          return syncResult.user;
        } else {
          console.log(`Unified sync failed: ${syncResult.error || 'Unknown error'}`);
        }
      } catch (syncError) {
        console.log(`Unified sync error: ${syncError.message}`);
      }
      
      // If unified sync failed, use local cache as fallback
      if (localUserData) {
        console.log(`Using cached data for offline mode: ${email}`);
        return localUserData;
      }
      
      console.log(`No user data available - server offline and no local cache`);
      return null;
    } catch (error) {
      console.error(`Error loading user data: ${error.message}`);
      
      // Try local storage as absolute last resort
      try {
        const userData = await AsyncStorage.getItem(`userData_${email.toLowerCase().trim()}`);
        if (userData) {
          console.log(`Using emergency cached data after error: ${email}`);
          return JSON.parse(userData);
        }
      } catch (e) {
        console.error(`Error loading from local cache: ${e.message}`);
      }
      return null;
    }
  };
  
  // Enhanced function to handle app state changes and sync data
  const handleAppStateChange = useCallback(async (nextAppState) => {
    // When the app comes to the foreground from background
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!');
      
      // Check if we have a current user and reload their data
      if (currentUser && currentUser.email) {
        // Reduced sync interval for better cross-device experience
        const now = Date.now();
        if (now - lastProfileSyncTime.current > MIN_SYNC_TIME) {
          console.log(`Reloading user data from database after app foregrounded for: ${currentUser.email}`);
          try {
            // First try to force profile image sync specifically
            try {
              const { forceProfileImageSync } = require('./services/DatabaseService');
              console.log('Forcing profile image sync after app foregrounded');
              const imageSyncResult = await forceProfileImageSync(currentUser.email);
              
              if (imageSyncResult.success && imageSyncResult.profileImage) {
                console.log(`Force sync successful, updating current user image from ${imageSyncResult.source}`);
                
                // Update current user with the synced image
                if (currentUser.profileImage !== imageSyncResult.profileImage) {
                  const updatedUser = {
                    ...currentUser,
                    profileImage: imageSyncResult.profileImage
                  };
                  setCurrentUser(updatedUser);
                  
                  // Also update in storage
                  const userDataKey = `userData_${currentUser.email.toLowerCase().trim()}`;
                  await AsyncStorage.setItem(userDataKey, JSON.stringify(updatedUser));
                }
              }
            } catch (imageSyncError) {
              console.log(`Error in foreground image sync: ${imageSyncError.message}`);
            }
            
            // Force a fresh sync with the server
            const updatedUser = await loadUserFromAllSources(currentUser.email);
            if (updatedUser) {
              console.log(`Successfully reloaded user data: ${updatedUser.name || currentUser.email}`);
              setCurrentUser(updatedUser);
              
              // Update last sync time to prevent multiple rapid syncs
              lastProfileSyncTime.current = now;
            }
          } catch (error) {
            console.error(`Error reloading user data: ${error.message}`);
          }
        } else {
          console.log(`Skipping profile reload - synced recently (throttled for ${Math.floor((MIN_SYNC_TIME - (now - lastProfileSyncTime.current))/1000)}s)`);
        }
      }
      
      // Also try to sync any pending updates, but with a delay to prevent UI lag
      setTimeout(async () => {
        try {
          await syncPendingUpdates();
        } catch (syncError) {
          console.log(`Error syncing pending updates: ${syncError.message}`);
        }
      }, 3000); // Reduced from 10s to 3s for faster updates
    }
    
    appState.current = nextAppState;
  }, [currentUser]);
  
  // Add AppState event listener in useEffect
  useEffect(() => {
    // Set up the app state change listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Clean up the subscription
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Improved loadUser function with unified sync
  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const email = await AsyncStorage.getItem('currentUserEmail');
      
      if (email) {
        console.log(`Loading user data from database for: ${email}`);
        let user = null;
        
        // First check for pending profile syncs and process them
        try {
          const { processPendingProfileSyncs } = require('./services/ImprovedProfileSyncService');
          await processPendingProfileSyncs();
        } catch (syncError) {
          console.log(`Error processing pending profile syncs: ${syncError.message}`);
        }
        
        // Then try to get user data with improved consistent sync
        try {
          const { getUserProfileWithConsistentSync } = require('./services/ImprovedProfileSyncService');
          const userData = await getUserProfileWithConsistentSync(email);
          
          if (userData) {
            console.log(`[FAILSAFE] Successfully loaded user data for ${userData.name}`);
            setCurrentUser(userData);
            setIsSignedIn(true);
            setIsLoading(false);
            return userData;
          } else {
            console.log(`No user data found using improved sync service for: ${email}`);
          }
        } catch (improvedSyncError) {
          console.log(`Error using improved sync service: ${improvedSyncError.message}`);
        }
        
        // Fall back to local data
        try {
          const localUserData = await AsyncStorage.getItem(`userData_${email.toLowerCase().trim()}`);
          if (localUserData) {
            console.log(`Using local data as fallback for: ${email}`);
            user = JSON.parse(localUserData);
          }
        } catch (localError) {
          console.log(`Error loading from local storage: ${localError.message}`);
        }
        
        if (user) {
          console.log(`User loaded: ${user.name || email}`);
          setCurrentUser(user);
          setIsSignedIn(true);
          lastProfileSyncTime.current = Date.now();
          setIsLoading(false);
          return user;
        }
      }
      
      console.log('No user found, setting to null');
      setCurrentUser(null);
      setIsSignedIn(false);
      setIsLoading(false);
      return null;
    } catch (error) {
      console.error(`Error loading user: ${error.message}`);
      setError(`Failed to load user: ${error.message}`);
      
      // Final fallback - always exit loading state and clear user
      setCurrentUser(null);
      setIsSignedIn(false);
      setIsLoading(false);
      return null;
    }
  }, []);

  // Enhanced saveUserData with better upload mechanism
  const saveUserData = useCallback(async (userData) => {
    try {
      console.log(`Saving user data for: ${userData.name || userData.email}`);
      console.log(`Profile image being saved: ${userData.profileImage ? 'YES' : 'NO'}`);
      
      if (userData.profileImage) {
        console.log(`Profile image URI: ${userData.profileImage}`);
        if (typeof userData.profileImage !== 'string') {
          console.warn('Profile image is not a string! Converting...', typeof userData.profileImage);
          userData.profileImage = String(userData.profileImage);
        }
      }
      
      const validated = validateUserData(userData);
      const email = validated.email.toLowerCase().trim();
      const key = `userData_${email}`;
      
      if (userData.profileImage && !validated.profileImage) {
        console.warn("Profile image was lost during validation! Fixing...");
        validated.profileImage = userData.profileImage;
      }
      
      // Preserve medical info if it was lost in validation
      if (userData.medicalInfo && (!validated.medicalInfo || 
          (!validated.medicalInfo.conditions && userData.medicalInfo.conditions) ||
          (!validated.medicalInfo.medications && userData.medicalInfo.medications) ||
          (!validated.medicalInfo.allergies && userData.medicalInfo.allergies) ||
          (!validated.medicalInfo.bloodType && userData.medicalInfo.bloodType))) {
        console.warn("Medical info was incomplete after validation! Fixing...");
        validated.medicalInfo = {
          ...validated.medicalInfo,
          conditions: userData.medicalInfo.conditions || validated.medicalInfo.conditions || '',
          medications: userData.medicalInfo.medications || validated.medicalInfo.medications || '',
          allergies: userData.medicalInfo.allergies || validated.medicalInfo.allergies || '',
          bloodType: userData.medicalInfo.bloodType || validated.medicalInfo.bloodType || ''
        };
      }
      
      // Always update the timestamp for proper sync ordering
      validated.updatedAt = new Date().toISOString();
      
      const userDataString = JSON.stringify(validated);
      console.log(`Saving data string (length ${userDataString.length})`);
      
      // Save locally first
      await AsyncStorage.setItem(key, userDataString);
      await AsyncStorage.setItem("currentUserEmail", validated.email);
      console.log(`User data successfully saved locally for: ${validated.email}`);
      
      // Also update the current user state if this is the current user
      if (currentUser && currentUser.email === validated.email) {
        console.log('Updating current user state with new data');
        setCurrentUser(validated);
      }
      
      // Try to sync immediately with server
      try {
        const { syncUserProfile } = require('./services/ServerSyncService');
        console.log(`Initiating immediate server sync for: ${validated.email}`);
      
        // Import SaveUserProfileToDB function
        const { saveUserProfileToDB } = require('./services/DatabaseService');
      
        // Attempt to save to server
        const serverResult = await saveUserProfileToDB(validated);
        
        if (serverResult && serverResult.success) {
          console.log(`Successfully synced user data to server for: ${validated.email}`);
          lastProfileSyncTime.current = Date.now();
          
          // If the server returned a profile, use that as source of truth
          if (serverResult.profile) {
            const mergedProfile = {
              ...validated,
              ...serverResult.profile,
              // Keep local profile image if present
              profileImage: validated.profileImage || serverResult.profile.profileImage,
              // Keep local medical info if more complete
              medicalInfo: validated.medicalInfo || serverResult.profile.medicalInfo
            };
        
            // Save the merged profile back to local storage
            await AsyncStorage.setItem(key, JSON.stringify(mergedProfile));
            
            // Update current user if needed
            if (currentUser && currentUser.email === validated.email) {
              setCurrentUser(mergedProfile);
            }
            
            return mergedProfile;
          }
      } else {
          console.log(`Server sync failed, adding to pending updates for later sync`);
          await addToPendingSyncs(validated);
        }
      } catch (syncError) {
        console.log(`Error syncing to server: ${syncError.message}`);
        await addToPendingSyncs(validated);
        }
        
      return validated;
    } catch (error) {
      console.error(`Error saving user data: ${error.message}`);
      setError(`Failed to save user data: ${error.message}`);
      return null;
    }
  }, [currentUser, setCurrentUser]);
        
  // New function to add user data to pending syncs for later upload
  const addToPendingSyncs = async (userData) => {
    try {
      const pendingSyncsKey = 'pendingProfileSyncs';
      const pendingSyncsStr = await AsyncStorage.getItem(pendingSyncsKey) || '[]';
      const pendingSyncs = JSON.parse(pendingSyncsStr);
      
      const email = userData.email.toLowerCase().trim();
      const existingIndex = pendingSyncs.findIndex(sync => sync.email === email);
      
      // Update or add to pending syncs
      if (existingIndex >= 0) {
        // Compare timestamps to ensure we keep the newest data
        const existingTime = new Date(pendingSyncs[existingIndex]?.profileData?.updatedAt || 0).getTime();
        const newTime = new Date(userData.updatedAt || Date.now()).getTime();
      
        if (newTime >= existingTime) {
          console.log(`Updating existing pending sync with newer data for: ${email}`);
          pendingSyncs[existingIndex] = {
            email,
            profileData: userData,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        console.log(`Adding new pending sync for: ${email}`);
        pendingSyncs.push({
          email,
          profileData: userData,
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(pendingSyncsKey, JSON.stringify(pendingSyncs));
      console.log(`Saved ${pendingSyncs.length} pending syncs for later processing`);
    } catch (error) {
      console.log(`Error adding to pending syncs: ${error.message}`);
    }
  };

  // Sync any pending updates with the server
  const syncPendingUpdates = useCallback(async () => {
    try {
      console.log('Processing any pending offline changes...');
      const { processOfflineChangesQueue, unifiedSyncUserData } = require('./services/ServerSyncService');
      
      // Process any pending offline changes
      const result = await processOfflineChangesQueue();
      
      // If we processed changes and have a current user, refresh their data
      if (result.success && result.processed > 0 && currentUser && currentUser.email) {
        console.log(`Processed ${result.processed} offline changes, refreshing current user data`);
        const syncResult = await unifiedSyncUserData(currentUser.email);
        
        if (syncResult.success && syncResult.user) {
          console.log(`Updated current user data after processing offline changes`);
          setCurrentUser(syncResult.user);
          return { success: true, synced: result.processed };
        }
      }
      
      return result;
    } catch (error) {
      console.log(`Error in syncPendingUpdates: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, [currentUser]);

  // Call this when user logs in
  const loginUser = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Logging in user: ${email}`);
      const normalizedEmail = email.toLowerCase().trim();
      
      // Import the login function from DatabaseService and unifiedSyncUserData
      const { loginWithDatabase } = require('./services/DatabaseService');
      const { unifiedSyncUserData, processOfflineChangesQueue } = require('./services/ServerSyncService');
      
      // Try to login with server first
      const loginResult = await loginWithDatabase({ email, password });
      
      if (loginResult.success && loginResult.user && loginResult.token) {
        console.log('Login successful with server');
        
        // Store auth state
        await AsyncStorage.setItem('isUserSignedIn', 'true');
        await AsyncStorage.setItem('currentUserEmail', normalizedEmail);
        await AsyncStorage.setItem('authToken', loginResult.token);
        
        // The user data from the server is the initial source of truth
        let userData = loginResult.user;
        
        // Store this data immediately as a baseline
        const userDataKey = `userData_${normalizedEmail}`;
        await AsyncStorage.setItem(userDataKey, JSON.stringify(userData));
        
        // Immediately try to fetch profile image using our aggressive fetch
        try {
          console.log('Immediately fetching profile image after login using aggressive fetch');
          
          // Use our new dedicated sync endpoint
          const { useAggressiveImageSync } = require('./services/DatabaseService');
          const imageResult = await useAggressiveImageSync(normalizedEmail);
          
          if (imageResult && imageResult.success && imageResult.profileImage) {
            console.log(`Successfully fetched profile image from ${imageResult.source}`);
            userData.profileImage = imageResult.profileImage;
          } else {
            // Fall back to our older method
            const imageResult = await aggressiveFetchProfileImage(normalizedEmail);
            
            if (imageResult && imageResult.profileImage) {
              console.log(`Successfully fetched profile image from ${imageResult.source}`);
              userData.profileImage = imageResult.profileImage;
            }
          }
        } catch (imageError) {
          console.log(`Error aggressively fetching profile image: ${imageError.message}`);
        }
        
        // After login, perform a comprehensive sync to ensure we have all user data
        try {
          console.log("Running full data sync after login");
          
          // First process any pending offline changes
          await processOfflineChangesQueue();
          
          // Then get the latest synced data
          const syncResult = await unifiedSyncUserData(normalizedEmail);
          
          if (syncResult.success && syncResult.user) {
            console.log("Full sync completed successfully after login");
            
            // Important: If the server doesn't have name but we do locally, preserve it
            if (!syncResult.user.name && userData.name) {
              console.log(`Server sync missing user name, preserving local name: ${userData.name}`);
              syncResult.user.name = userData.name;
            }
            
            // Important: If the server doesn't have profile image but we do locally, preserve it
            if ((!syncResult.user.profileImage || syncResult.user.profileImage === '') && userData.profileImage) {
              console.log('Server sync missing profile image, preserving local image');
              syncResult.user.profileImage = userData.profileImage;
              
              // Update the sync result with our merged data
              try {
                const { saveUserProfileToDB } = require('./services/DatabaseService');
                console.log('Sending merged data back to server to update missing fields');
                await saveUserProfileToDB(syncResult.user);
              } catch (updateError) {
                console.log(`Error updating server with merged data: ${updateError.message}`);
              }
            }
            
            // Use the merged and synced data
            userData = syncResult.user;
          } else if (syncResult.user) {
            console.log("Sync had issues but returned user data");
            userData = syncResult.user;
          }
        } catch (syncError) {
          console.log(`Post-login sync error: ${syncError.message}`);
          // Continue with the login data we already have
        }
        
        // Apply name consistency check
        if (userData.name) {
          // Store the canonical name separately for consistency checks
          try {
            await AsyncStorage.setItem(`canonicalName_${normalizedEmail}`, userData.name);
          } catch (nameError) {
            console.log(`Error storing canonical name: ${nameError.message}`);
          }
        }
        
        // Apply profile image consistency check
        await checkProfileImageConsistency(normalizedEmail);
        
        // Update state with the final user data
        setCurrentUser(userData);
        setIsSignedIn(true);
        setIsLoading(false);
        return userData;
      } 
      
      // Server login failed, try local fallback
      console.log('Server login failed, checking local data');
      
      // Check if we have local data for this user
      const localDataStr = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
      if (localDataStr) {
        try {
          // Use local data if available
          const localUserData = JSON.parse(localDataStr);
          
          // Ensure we have profile image if it exists separately
          try {
            const profileImageKey = `profileImage_${normalizedEmail}`;
            const separateImage = await AsyncStorage.getItem(profileImageKey);
            
            if (separateImage && (!localUserData.profileImage || localUserData.profileImage !== separateImage)) {
              console.log('Found separately stored profile image, using for local login');
              localUserData.profileImage = separateImage;
              
              // Update stored user data with the image
              await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(localUserData));
            }
          } catch (imageError) {
            console.log(`Error checking separate profile image: ${imageError.message}`);
          }
          
          // Store auth state for local-only login
          await AsyncStorage.setItem('isUserSignedIn', 'true');
          await AsyncStorage.setItem('currentUserEmail', normalizedEmail);
          
          // Run consistency checks
          await checkNameConsistency(normalizedEmail);
          await checkProfileImageConsistency(normalizedEmail);
          
          console.log('Logging in with local data');
          setCurrentUser(localUserData);
          setIsSignedIn(true);
          setIsLoading(false);
          
          // Queue this for sync when back online
          const { queueOfflineChange } = require('./services/ServerSyncService');
          await queueOfflineChange(normalizedEmail, 'loginAttempt', { timestamp: new Date().toISOString() });
          
          return localUserData;
        } catch (localError) {
          console.log(`Error with local login: ${localError.message}`);
        }
      }
      
      console.log('Login failed - no valid credentials found');
      setError('Invalid credentials or network error');
      setIsLoading(false);
      return null;
    } catch (error) {
      console.error(`Login error: ${error.message}`);
      setError('Login failed. Please try again.');
      setIsLoading(false);
      return null;
    }
  }, [checkNameConsistency, checkProfileImageConsistency, aggressiveFetchProfileImage]);

  // Enhanced updateUser function with retry mechanism
  const updateUserWithRetry = useCallback(async (updatedUserData) => {
    try {
      if (!updatedUserData) {
        console.error("Invalid user data for update - updatedUserData is null");
        return false;
      }
      
      // Create a copy of the data to avoid reference issues
      const userDataCopy = {...updatedUserData};
      
      // Ensure we have an email
      if (!userDataCopy.email) {
        console.log("Missing email in update data, checking current user");
        
        // Try to get email from current user
        if (currentUser && currentUser.email) {
          userDataCopy.email = currentUser.email;
        } else {
          // Try to get from AsyncStorage
          const email = await AsyncStorage.getItem('currentUserEmail');
          if (email) {
            userDataCopy.email = email;
          } else {
            console.error("No email available for user update");
            return false;
          }
        }
      }
      
      const normalizedEmail = userDataCopy.email.toLowerCase().trim();
      
      // Always attach a fresh timestamp
      userDataCopy.updatedAt = new Date().toISOString();
      
      console.log(`Updating user data with retry: ${userDataCopy.name || normalizedEmail}`);
      
      // Check if this update includes a profile image change
      const hasProfileImageUpdate = userDataCopy.profileImage && 
        (!currentUser || !currentUser.profileImage || 
         currentUser.profileImage !== userDataCopy.profileImage);
      
      if (hasProfileImageUpdate) {
        console.log("Profile image update detected - will force cross-device sync");
      }
      
      // Check consistency before update
      await checkNameConsistency(normalizedEmail);
      await checkProfileImageConsistency(normalizedEmail);
      
      // Ensure critical fields are preserved
      if (currentUser) {
        // Preserve profile image if missing
        if (!userDataCopy.profileImage && currentUser.profileImage) {
          userDataCopy.profileImage = currentUser.profileImage;
        }
      }
      
      // Try to update with multiple retry attempts
      let success = false;
      let lastError = null;
      const maxAttempts = 3;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`Retry attempt ${attempt} for updating user profile`);
            // Add short delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Try cloudStoreUserProfile first
          const { cloudStoreUserProfile } = require('./services/DatabaseService');
          const result = await cloudStoreUserProfile(userDataCopy);
          
          if (result.success) {
            console.log('User successfully updated');
            
            // Use the returned profile or our data
            const updatedProfile = result.profile || userDataCopy;
            setCurrentUser(updatedProfile);
            
            // Store redundant copies for better reliability
            await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(updatedProfile));
            
            if (updatedProfile.profileImage) {
              await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, updatedProfile.profileImage);
            }
            
            if (updatedProfile.name) {
              await AsyncStorage.setItem(`canonicalName_${normalizedEmail}`, updatedProfile.name);
            }
            
            // If this includes a profile image update, force sync to all devices
            if (hasProfileImageUpdate) {
              try {
                const { forceSyncAllDeviceProfiles } = require('./services/DatabaseService');
                console.log("Forcing profile image sync to all devices");
                forceSyncAllDeviceProfiles(normalizedEmail)
                  .catch(syncError => console.log(`Error in forced sync: ${syncError.message}`));
              } catch (syncError) {
                console.log(`Error importing sync function: ${syncError.message}`);
              }
            }
            
            success = true;
            break;
          } else if (result.localOnly) {
            console.log('Profile saved locally only, will sync when back online');
            setCurrentUser(userDataCopy);
            success = true;
            break;
          } else {
            lastError = result.error;
          }
        } catch (attemptError) {
          console.log(`Error in attempt ${attempt}: ${attemptError.message}`);
          lastError = attemptError.message;
        }
      }
      
      if (!success) {
        console.log(`All update attempts failed: ${lastError}`);
        
        // Last resort: try to at least update the local data
        try {
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userDataCopy));
          setCurrentUser(userDataCopy);
          console.log('Saved profile locally as fallback');
          return true;
        } catch (localSaveError) {
          console.log(`Local save also failed: ${localSaveError.message}`);
          return false;
        }
      }
      
      return success;
    } catch (error) {
      console.error(`User update error: ${error.message}`);
      return false;
    }
  }, [currentUser]);

  // Call this when user logs out
  const logoutUser = useCallback(async () => {
    try {
      // Always sync pending updates before logout
      await syncPendingUpdates();
      
      console.log("Logging out user");
      
      // Clear user's auth state
      await AsyncStorage.setItem('isUserSignedIn', 'false');
      await AsyncStorage.removeItem('authToken');
      
      // Don't remove user data or email - we want to keep it for next login
      
      setIsSignedIn(false);
      setCurrentUser(null);
      
      return true;
    } catch (error) {
      console.error(`Logout error: ${error.message}`);
      setError(`Logout failed: ${error.message}`);
      return false;
    }
  }, [syncPendingUpdates]);

  // Helper function to ensure profile data is loaded when needed
  const ensureUserDataLoaded = useCallback(async () => {
    // Only run if we're signed in but don't have current user data
    if (isSignedIn && !currentUser) {
      console.log("[FAILSAFE] isSignedIn is true but currentUser is null - forcing user data load");
        
        try {
        // Check if we have an email stored
          const email = await AsyncStorage.getItem('currentUserEmail');
        if (email) {
          console.log(`[FAILSAFE] Found email in storage: ${email}, loading user data`);
          const userData = await loadUserFromAllSources(email);
          
          if (userData) {
            console.log(`[FAILSAFE] Successfully loaded user data for ${userData.name}`);
              setCurrentUser(userData);
            return userData;
            }
      }
    } catch (error) {
        console.log(`[FAILSAFE] Error in ensureUserDataLoaded: ${error.message}`);
        }
      }
    
    return currentUser;
  }, [isSignedIn, currentUser, loadUserFromAllSources]);

  // Run the ensureUserDataLoaded function when isSignedIn changes
  useEffect(() => {
    if (isSignedIn) {
    ensureUserDataLoaded();
    }
  }, [isSignedIn, ensureUserDataLoaded]);

  // Add real-time sync functionality
  const startRealtimeSync = useCallback((email) => {
    // Clear any existing interval
    if (realtimeSyncInterval.current) {
      clearInterval(realtimeSyncInterval.current);
      realtimeSyncInterval.current = null;
    }
    
    if (!email) return;
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`MONGODB: Starting real-time sync for: ${normalizedEmail}`);
    
    // Function to check for updates from other devices
    const checkForDeviceUpdates = async () => {
      try {
        // Don't check if a manual sync is already in progress
        if (manualSyncInProgress) {
          console.log(`MONGODB: Manual sync in progress, skipping automatic check`);
          return;
        }
        
        console.log(`MONGODB: Checking for updates from other devices for: ${normalizedEmail}`);
        const updateResult = await checkForRemoteUpdates(normalizedEmail);
        
        if (updateResult.success && updateResult.hasUpdates && updateResult.profile) {
          console.log(`MONGODB: Found new data from another device! Updating...`);
          
          // Update current user with the latest data
          const mergedProfile = {
            ...updateResult.profile,
            // Set flag to indicate this was from another device
            _syncedFromOtherDevice: true,
            _syncTime: new Date().toISOString()
          };
          
          setCurrentUser(mergedProfile);
          
          // Cache locally for offline access
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
            ...mergedProfile,
            _localCacheTime: new Date().toISOString()
          }));
          
          console.log(`MONGODB: User data updated from another device`);
          
          // Trigger any local listeners or UI updates
          // This is important to refresh the UI immediately
          try {
            // Use DeviceEventEmitter to notify app components
            DeviceEventEmitter.emit('profileSyncUpdate', { 
              email: normalizedEmail, 
              timestamp: Date.now() 
            });
          } catch (eventError) {
            console.log('Error emitting sync event:', eventError);
          }
        }
    } catch (error) {
        console.log(`MONGODB: Error checking for remote updates: ${error.message}`);
      }
    };
    
    // Start the interval for real-time updates
    realtimeSyncInterval.current = setInterval(checkForDeviceUpdates, REALTIME_SYNC_INTERVAL);
    
    // Run once immediately
    checkForDeviceUpdates();
    
    // Add a function for manual sync that can be called on demand
    const forceSyncNow = async () => {
      try {
        // Set flag to prevent interval from running concurrently
        manualSyncInProgress = true;
        
        console.log(`MONGODB: Forcing immediate sync for: ${normalizedEmail}`);
        
        // Fetch latest data directly from MongoDB
        const latestData = await cloudGetUserProfile(normalizedEmail);
        
        if (latestData.success && latestData.profile) {
          console.log(`MONGODB: Forced sync successful`);
          
          // Update the current user state
          setCurrentUser(latestData.profile);
        }
        
        manualSyncInProgress = false;
        return latestData.success;
      } catch (error) {
        console.log(`MONGODB: Forced sync error: ${error.message}`);
        manualSyncInProgress = false;
        return false;
      }
    };
    
    // Return a cleanup function and the manual sync function
    return {
      cleanup: () => {
        if (realtimeSyncInterval.current) {
          clearInterval(realtimeSyncInterval.current);
        }
      },
      forceSyncNow
    };
  }, []);

  // Add a function to force immediate sync on demand (like when returning to app)
  const forceImmediateSync = useCallback(async () => {
    try {
      if (!isSignedIn || !currentUser || !currentUser.email) {
        console.log("MONGODB: Can't force sync - no user logged in");
        return false;
      }
      
      const normalizedEmail = currentUser.email.toLowerCase().trim();
      console.log(`MONGODB: Forcing immediate profile sync for: ${normalizedEmail}`);
      
      // Set flag to prevent automatic sync during manual sync
      manualSyncInProgress = true;
      
      // Direct call to MongoDB to get the latest data
      const response = await cloudGetUserProfile(normalizedEmail);
      
      if (response.success && response.profile) {
        // Check if there's actually a difference in the data
        const serverTime = new Date(response.profile.updatedAt || 0).getTime();
        const localTime = new Date(currentUser.updatedAt || 0).getTime();
        
        if (serverTime > localTime || hasProfileChanged(currentUser, response.profile)) {
          console.log(`MONGODB: Found newer data on server during force sync`);
          
          // Update the current user state
          setCurrentUser(response.profile);
          
          // Cache locally
          await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify({
            ...response.profile,
            _localCacheTime: new Date().toISOString()
          }));
            } else {
          console.log(`MONGODB: No newer data found during force sync`);
        }
        
        manualSyncInProgress = false;
        return true;
      }
      
      manualSyncInProgress = false;
      return false;
    } catch (error) {
      console.log(`MONGODB: Force sync error: ${error.message}`);
      manualSyncInProgress = false;
      return false;
    }
  }, [currentUser, isSignedIn]);

  // Add an effect to handle profile sync events from other app components
  useEffect(() => {
    if (!isSignedIn || !currentUser || !currentUser.email) return;
    
    const handleProfileSyncEvent = async (data) => {
      try {
        if (data && data.email && data.email === currentUser.email.toLowerCase().trim()) {
          console.log(`MONGODB: Received sync event for current user, timestamp: ${data.timestamp}`);
          
          // Force immediate sync
          await forceImmediateSync();
        }
      } catch (error) {
        console.log(`MONGODB: Error handling sync event: ${error.message}`);
      }
    };
    
    // Listen for profile sync events using DeviceEventEmitter
    const subscription = DeviceEventEmitter.addListener('profileSyncUpdate', handleProfileSyncEvent);
    
    return () => {
      // Clean up listener when component unmounts
      subscription.remove();
    };
  }, [isSignedIn, currentUser, forceImmediateSync]);
  
  // Start listening for incoming sync push notifications (if available)
  useEffect(() => {
    if (!isSignedIn || !currentUser || !currentUser.email) return;
    
    // This would typically connect to a push notification service
    // or a WebSocket for real-time updates
    console.log('MONGODB: Setting up push notification listeners for real-time sync');
    
    // Cleanup function returned for when component unmounts
    return () => {
      console.log('MONGODB: Cleaning up push notification listeners');
    };
  }, [isSignedIn, currentUser]);

  // Add a helper function to ensure profile images are consistent across devices
  const checkProfileImageConsistency = async (email) => {
    if (!email) return;
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const userDataKey = `userData_${normalizedEmail}`;
      const profileImageKey = `profileImage_${normalizedEmail}`;
      
      // Get currently stored profile image and user data
      const userData = await AsyncStorage.getItem(userDataKey);
      const separateProfileImage = await AsyncStorage.getItem(profileImageKey);
      
      if (userData) {
        const parsedData = JSON.parse(userData);
        
        // If we have a separate stored profile image but the user data doesn't have one
        if (separateProfileImage && (!parsedData.profileImage || parsedData.profileImage === '')) {
          console.log(`Profile image inconsistency detected! Adding stored image to user data`);
          
          // Update local user data with the image
          parsedData.profileImage = separateProfileImage;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(parsedData));
          
          // If this is the current user, update state
          if (currentUser && currentUser.email === normalizedEmail) {
            setCurrentUser({...currentUser, profileImage: separateProfileImage});
            console.log('Updated current user state with stored profile image');
          }
          
          // Queue an update to the server with the image
          try {
            const { saveUserProfileToDB } = require('./services/DatabaseService');
            console.log('Sending profile image to server to maintain consistency');
            await saveUserProfileToDB({...parsedData, profileImage: separateProfileImage});
          } catch (serverError) {
            console.log(`Error updating server with profile image: ${serverError.message}`);
          }
        } 
        // If user data has a profile image but we don't have it stored separately
        else if (parsedData.profileImage && !separateProfileImage) {
          console.log(`Storing profile image separately for redundancy`);
          await AsyncStorage.setItem(profileImageKey, parsedData.profileImage);
        }
        // If we don't have any profile image, try to get one using aggressive fetch
        else if (!parsedData.profileImage && !separateProfileImage) {
          console.log('No profile image found locally, using aggressive fetch');
          
          // Use our new aggressive fetch function
          const result = await aggressiveFetchProfileImage(normalizedEmail);
          
          if (result && result.profileImage) {
            console.log(`Successfully fetched profile image from ${result.source}`);
            
            // No need to update anything as aggressive fetch does that automatically
          }
        }
      }
    } catch (error) {
      console.log(`Error checking profile image consistency: ${error.message}`);
    }
  };

  // Add a new aggressive profile image sync function
  const aggressiveFetchProfileImage = useCallback(async (email) => {
    if (!email) return null;
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`AGGRESSIVE IMAGE FETCH: Starting for ${normalizedEmail}`);
    
    let profileImage = null;
    let source = null;
    
    // 1. First check separately stored image locally
    try {
      const profileImageKey = `profileImage_${normalizedEmail}`;
      const separateImage = await AsyncStorage.getItem(profileImageKey);
      
      if (separateImage) {
        console.log(`AGGRESSIVE IMAGE FETCH: Found separate local image`);
        profileImage = separateImage;
        source = 'local_separate';
      }
    } catch (error) {
      console.log(`AGGRESSIVE IMAGE FETCH: Error checking separate image: ${error.message}`);
    }
    
    // 2. Check user data in local storage
    if (!profileImage) {
      try {
        const userDataKey = `userData_${normalizedEmail}`;
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          const userObj = JSON.parse(userData);
          if (userObj.profileImage) {
            console.log(`AGGRESSIVE IMAGE FETCH: Found image in local user data`);
            profileImage = userObj.profileImage;
            source = 'local_user_data';
          }
        }
      } catch (error) {
        console.log(`AGGRESSIVE IMAGE FETCH: Error checking local user data: ${error.message}`);
      }
    }
    
    // 3. Try direct connection to server with multiple retries
    if (!profileImage) {
      try {
        console.log(`AGGRESSIVE IMAGE FETCH: Trying dedicated sync endpoint`);
        const { useAggressiveImageSync } = require('./services/DatabaseService');
        
        const syncResult = await useAggressiveImageSync(normalizedEmail);
        
        if (syncResult.success && syncResult.profileImage) {
          console.log(`AGGRESSIVE IMAGE FETCH: Found image via dedicated sync from ${syncResult.source}`);
          profileImage = syncResult.profileImage;
          source = syncResult.source;
        } else {
          // Fall back to our existing direct connection approach
          const serverUrl = await getActiveServerUrl();
          const endpoints = [
            `${serverUrl}/api/profile/image/${normalizedEmail}`,
            `${serverUrl}/api/users/profile/image/${normalizedEmail}`,
            `${serverUrl}/api/user/profile/image/${normalizedEmail}`,
            `${serverUrl}/api/user/profile/${normalizedEmail}`,
            `${serverUrl}/api/users/profile/${normalizedEmail}`,
            `${serverUrl}/users/${normalizedEmail}/profile`
          ];
          
          // Try multiple times for better reliability
          const maxRetries = 3;
          
          for (let retry = 0; retry < maxRetries && !profileImage; retry++) {
            if (retry > 0) {
              console.log(`AGGRESSIVE IMAGE FETCH: Retry attempt ${retry+1}/${maxRetries}`);
              // Add delay between retries
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            for (const endpoint of endpoints) {
              try {
                console.log(`AGGRESSIVE IMAGE FETCH: Trying endpoint ${endpoint}`);
                const response = await axios.get(endpoint, { 
                  timeout: 8000,
                  headers: await getAuthHeaders()
                });
                
                if (response.data && response.data.profileImage) {
                  console.log(`AGGRESSIVE IMAGE FETCH: Found image on server via ${endpoint}`);
                  profileImage = response.data.profileImage;
                  source = 'server_direct';
                  break;
                } else if (response.data && response.data.user && response.data.user.profileImage) {
                  console.log(`AGGRESSIVE IMAGE FETCH: Found image in user object via ${endpoint}`);
                  profileImage = response.data.user.profileImage;
                  source = 'server_user_object';
                  break;
                } else if (response.data && response.data.profile && response.data.profile.profileImage) {
                  console.log(`AGGRESSIVE IMAGE FETCH: Found image in profile object via ${endpoint}`);
                  profileImage = response.data.profile.profileImage;
                  source = 'server_profile_object';
                  break;
                }
              } catch (endpointError) {
                console.log(`AGGRESSIVE IMAGE FETCH: Endpoint ${endpoint} failed: ${endpointError.message}`);
              }
            }
            
            if (profileImage) break;
          }
        }
      } catch (serverError) {
        console.log(`AGGRESSIVE IMAGE FETCH: Server error: ${serverError.message}`);
      }
    }
    
    // If we found an image, save it everywhere for redundancy
    if (profileImage) {
      try {
        console.log(`AGGRESSIVE IMAGE FETCH: Saving image to all storage locations`);
        
        // Save to separate key
        await AsyncStorage.setItem(`profileImage_${normalizedEmail}`, profileImage);
        
        // Update user data
        const userDataKey = `userData_${normalizedEmail}`;
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          const userObj = JSON.parse(userData);
          
          // Only update if different to avoid unnecessary writes
          if (!userObj.profileImage || userObj.profileImage !== profileImage) {
            console.log('AGGRESSIVE IMAGE FETCH: Updating user data with profile image');
            userObj.profileImage = profileImage;
            await AsyncStorage.setItem(userDataKey, JSON.stringify(userObj));
            
            // Update current user if needed
            if (currentUser && currentUser.email === normalizedEmail) {
              setCurrentUser({...currentUser, profileImage});
            }
          }
        }
        
        // Try to sync to server in background
        try {
          const { forceSyncAllDeviceProfiles } = require('./services/DatabaseService');
          console.log('AGGRESSIVE IMAGE FETCH: Force syncing to all devices in background');
          
          // Wrap in Promise.resolve to avoid blocking
          Promise.resolve(forceSyncAllDeviceProfiles(normalizedEmail))
            .catch(error => console.log(`AGGRESSIVE IMAGE FETCH: Error in background sync: ${error.message}`));
        } catch (syncError) {
          console.log(`AGGRESSIVE IMAGE FETCH: Error importing sync function: ${syncError.message}`);
        }
      } catch (saveError) {
        console.log(`AGGRESSIVE IMAGE FETCH: Error saving image: ${saveError.message}`);
      }
    }
    
    return { profileImage, source };
  }, [currentUser]);
  
  // Maintain the original updateUser function for compatibility, but use our enhanced version
  const updateUser = useCallback(async (updatedUserData) => {
    console.log(`Updating user profile with enhanced retry mechanism`);
    return await updateUserWithRetry(updatedUserData);
  }, [updateUserWithRetry]);

  // Export the context value
  const contextValue = {
    currentUser,
    isSignedIn,
    isLoading,
    error,
    loginUser,
    logoutUser,
    updateUser,
    loadUser,
    clearUserData,
    syncPendingUpdates,
    ensureUserDataLoaded,
    startRealtimeSync,
    forceImmediateSync,
    checkNameConsistency,
    checkProfileImageConsistency,
    updateUserWithRetry
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to use the user context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};