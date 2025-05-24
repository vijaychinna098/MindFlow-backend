import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { syncAllCaregiverData, syncCaregiverPatients } from './services/ServerSyncService';

// Import FileSystem safely, with a try-catch block 
let FileSystem;
try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.log('FileSystem module could not be loaded:', error.message);
  FileSystem = null;
}

const CaregiverContext = createContext();

const validateUserData = (data) => {
  if (!data?.email) throw new Error('Invalid user data');
  
  // Log the medical information that's coming in
  console.log("Validating caregiver medical info:", 
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
    patientEmail: data.patientEmail || '', // Add patientEmail here
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

export const CaregiverProvider = ({ children }) => {
  const [caregiver, setCaregiver] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePatient, setActivePatient] = useState(null);
  const [deactivationTime, setDeactivationTime] = useState(null);
  const [statusUpdateTrigger, setStatusUpdateTrigger] = useState(0); // Used to trigger re-renders on status change
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCaregiver = async () => {
      try {
        console.log("Loading caregiver data from AsyncStorage...");
        const email = await AsyncStorage.getItem("currentUserEmail");
        
        if (email) {
          console.log(`Found current user email: ${email}`);
          const key = `caregiverData_${email}`;
          const stored = await AsyncStorage.getItem(key);
          
          if (stored) {
            const parsed = JSON.parse(stored);
            console.log(`Loaded caregiver data for: ${parsed.name || email}`);
            console.log(`Profile image found: ${parsed.profileImage ? 'YES' : 'NO'}`);
            
            // Check if we need to recover a missing profile image from our backup keys
            if (!parsed.profileImage) {
              console.log("Profile image missing, checking backup sources...");
              
              // Check if caregiver has a profile image flag set
              const hasProfileImage = await AsyncStorage.getItem(`caregiverHasProfileImage_${email.toLowerCase().trim()}`);
              if (hasProfileImage === "true") {
                console.log("Caregiver has profile image flag set, retrieving backed up path");
                
                // Get the backed up profile image path
                const backupPath = await AsyncStorage.getItem(`caregiverProfileImagePath_${email.toLowerCase().trim()}`);
                if (backupPath) {
                  console.log(`Recovered profile image path from backup: ${backupPath}`);
                  parsed.profileImage = backupPath;
                  
                  // Save the recovered path back to the main caregiver data
                  await AsyncStorage.setItem(key, JSON.stringify(parsed));
                  console.log("Restored profile image path to main caregiver data");
                }
              }
            }
            
            if (parsed.profileImage) {
              console.log(`Profile image URI: ${parsed.profileImage}`);
              if (typeof parsed.profileImage === 'string' && parsed.profileImage.startsWith('http')) {
                console.log('Profile image is a URL');
              } else if (typeof parsed.profileImage === 'string' && parsed.profileImage.startsWith('file')) {
                console.log('Profile image is a file path');
                
                // Verify the file exists
                try {
                  // Check if FileSystem is available first
                  if (!FileSystem || typeof FileSystem === 'undefined') {
                    console.log("FileSystem module is not available - skipping file check");
                  }
                  else if (typeof FileSystem.getInfoAsync === 'function') {
                    const fileInfo = await FileSystem.getInfoAsync(parsed.profileImage);
                    console.log(`Profile image file exists: ${fileInfo.exists}`);
                    
                    if (!fileInfo.exists) {
                      console.log("Profile image file doesn't exist, checking backup");
                      // Try to get backup path
                      const backupPath = await AsyncStorage.getItem(`caregiverProfileImagePath_${email.toLowerCase().trim()}`);
                      if (backupPath && backupPath !== parsed.profileImage) {
                        console.log(`Trying backup path: ${backupPath}`);
                        if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
                          try {
                            const backupInfo = await FileSystem.getInfoAsync(backupPath);
                            if (backupInfo.exists) {
                              console.log("Backup image exists, using it instead");
                              parsed.profileImage = backupPath;
                            }
                          } catch (error) {
                            console.log("Error checking backup file, continuing with available data");
                          }
                        } else {
                          console.log("FileSystem or getInfoAsync method is not available for backup check");
                        }
                      }
                    }
                  } else {
                    console.log("FileSystem.getInfoAsync method is not available");
                  }
                } catch (fsError) {
                  console.log("Error checking profile image file, continuing with available data");
                  // Continue with execution even if file check fails
                }
              } else {
                console.log('Profile image is an unknown format');
              }
            }
            
            if (parsed.email) {
              setCaregiver(parsed);
              
              // After setting the caregiver, sync the connected patients from the server
              try {
                console.log("Syncing caregiver's connected patients from server...");
                const syncResult = await syncCaregiverPatients(parsed.email, parsed.id);
                
                if (syncResult.success) {
                  console.log(`Successfully synced ${syncResult.patients?.length || 0} patients from ${syncResult.source}`);
                  console.log(`Sync message: ${syncResult.message}`);
                  
                  // After syncing patients, check if there's an active patient
                  console.log("Checking for active patient after patient sync...");
                } else {
                  console.log(`Failed to sync patients: ${syncResult.message}`);
                }
              } catch (syncError) {
                console.log("Error syncing caregiver patients:", syncError.message);
                // Continue with login process even if patient sync fails
              }
            }
            
            // Try to load the active patient
            try {
              const activePatientKey = `activePatient_${parsed.email}`;
              const storedActivePatient = await AsyncStorage.getItem(activePatientKey);
              if (storedActivePatient) {
                const activePatientData = JSON.parse(storedActivePatient);
                console.log(`Loaded active patient: ${activePatientData.name}`);
                setActivePatient(activePatientData);
              }
            } catch (error) {
              console.log('Load caregiver error: Continuing with available data');
            }
          } else {
            console.log(`No caregiver data found for email: ${email}`);
          }
        } else {
          console.log("No current user email found");
        }
      } catch (e) {
        console.log('Load caregiver error: Continuing with available data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCaregiver();
  }, []);

  const saveCaregiverData = useCallback(async (caregiverData) => {
    try {
      console.log(`Saving caregiver data for: ${caregiverData.name || caregiverData.email}`);
      console.log(`Profile image being saved: ${caregiverData.profileImage ? 'YES' : 'NO'}`);
      
      if (caregiverData.profileImage) {
        console.log(`Profile image URI: ${caregiverData.profileImage}`);
        if (typeof caregiverData.profileImage !== 'string') {
          console.log('Profile image is not a string! Converting...', typeof caregiverData.profileImage);
          caregiverData.profileImage = String(caregiverData.profileImage);
        }
      }
      
      const validated = validateUserData(caregiverData);
      const key = `caregiverData_${validated.email}`;
      
      if (caregiverData.profileImage && !validated.profileImage) {
        console.log("Profile image was lost during validation! Fixing...");
        validated.profileImage = caregiverData.profileImage;
      }
      
      const caregiverDataString = JSON.stringify(validated);
      console.log(`Saving data string (length ${caregiverDataString.length})`);
      
      await AsyncStorage.setItem(key, caregiverDataString);
      await AsyncStorage.setItem("currentUserEmail", validated.email);
      console.log(`Caregiver data successfully saved for: ${validated.email}`);
      
      const savedData = await AsyncStorage.getItem(key);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log(`Verified saved data. Profile image present: ${parsed.profileImage ? 'YES' : 'NO'}`);
      }
      
      return true;
    } catch (e) {
      console.log('Save error: Unable to save caregiver data');
      return false;
    }
  }, []);

  // First, I'll create a safer check-patient function
  const verifyPatientConnection = async (patientEmail, token) => {
    console.log(`Checking if patient ${patientEmail} exists...`);
    
    try {
      // Check for valid parameters
      if (!patientEmail) {
        console.log("No patient email provided for verification");
        return false;
      }
      
      // Handle direct require in a safer way
      let axios;
      let API_BASE_URL;
      
      try {
        const config = require('./config');
        API_BASE_URL = config.API_BASE_URL;
        axios = require('axios').default; // Ensure we get the default export
      } catch (importError) {
        console.log(`Error importing axios or config: ${importError.message}`);
        // If we can't import axios, assume offline and keep the connection
        return true;
      }
      
      // Verify axios is properly imported
      if (!axios || typeof axios.get !== 'function') {
        console.log("Error suppressed: axios.get is not available - assuming offline mode");
        // Don't disconnect when offline
        return true;
      }
      
      // Try the API call with proper error handling
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/caregivers/check-patient/${patientEmail.toLowerCase()}`, 
          { 
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            timeout: 5000 // 5 second timeout
          }
        );
        
        // Check response
        if (response && response.data && response.data.exists === true) {
          console.log(`Verified patient ${patientEmail} exists`);
          return true;
        } else if (response && response.data && response.data.exists === false) {
          console.log(`Patient ${patientEmail} no longer exists in the database`);
          return false;
        } else {
          // For ambiguous responses, keep the connection
          console.log(`Ambiguous response from server for ${patientEmail} - keeping connection`);
          return true;
        }
      } catch (apiError) {
        // Handle API errors specifically
        if (apiError.response && apiError.response.status === 404) {
          console.log(`Patient ${patientEmail} not found (404)`);
          return false;
        } else {
          // For network errors or server issues, keep the connection
          console.log(`Network error checking patient ${patientEmail} - keeping connection`, apiError.message);
          // Don't disconnect for network errors
          return true;
        }
      }
    } catch (error) {
      console.log(`General error in verifyPatientConnection: ${error.message}`);
      // Don't disconnect on general errors
      return true;
    }
  };

  // Now update the patient disconnection handling
  const disconnectFromPatient = async (patientEmail, caregiverEmail) => {
    console.log(`Disconnecting from patient ${patientEmail}`);
    
    // Only proceed with disconnection if the patient truly doesn't exist (server confirmed)
    // First verify the disconnect is necessary
    const shouldDisconnect = await verifyPatientConnection(patientEmail, null);
    
    // Only disconnect if verification specifically returned false (patient doesn't exist)
    if (shouldDisconnect === false) {
      try {
        // Handle direct require in a safer way
        let axios;
        let API_BASE_URL;
        
        try {
          const config = require('./config');
          API_BASE_URL = config.API_BASE_URL;
          axios = require('axios').default;
        } catch (importError) {
          console.log(`Error importing axios or config for disconnect: ${importError.message}`);
          // Proceed with local disconnect only
          return true;
        }
        
        // Verify axios is properly imported
        if (!axios || typeof axios.post !== 'function') {
          console.log("axios.post is not available - proceeding with local disconnect only");
          return true;
        }
        
        // Attempt to tell the server about the disconnection
        try {
          await axios.post(
            `${API_BASE_URL}/api/caregivers/disconnect-patient`,
            { 
              patientEmail: patientEmail,
              caregiverEmail: caregiverEmail 
            },
            { timeout: 5000 }
          );
          console.log("Server connection removed");
          return true;
        } catch (apiError) {
          console.log("Error in server disconnect - continuing with local disconnect", apiError.message);
          // Still return true - we'll continue with the disconnect locally even if server call fails
          return true;
        }
      } catch (error) {
        console.log(`General error in disconnectFromPatient: ${error.message}`);
        // Still return true so we continue with the local disconnect
        return true;
      }
    } else {
      console.log(`Not disconnecting from patient ${patientEmail} - verification indicates patient still exists`);
      return false;
    }
  };

  // Now fix the loginCaregiver method
  const loginCaregiver = useCallback(async (caregiverData) => {
    try {
      console.log("===== LOGIN CAREGIVER START =====");
      console.log("Login credentials email:", caregiverData.email);
      
      // First, check if we already have data for this caregiver in AsyncStorage
      const key = `caregiverData_${caregiverData.email.toLowerCase().trim()}`;
      const existingData = await AsyncStorage.getItem(key);
      
      if (existingData) {
        console.log("FOUND EXISTING CAREGIVER DATA in AsyncStorage");
        const parsed = JSON.parse(existingData);
        console.log("Existing name:", parsed.name);
        console.log("Existing profile image:", parsed.profileImage ? "YES" : "NO");
        console.log("Existing medical info:", parsed.medicalInfo ? "YES" : "NO");
        
        // Merge login data with existing stored data, prioritizing stored data for non-auth fields
        const mergedData = {
          ...parsed,
          // Only update authentication-related fields from login
          token: caregiverData.token || parsed.token,
          // Ensure email matches login email
          email: caregiverData.email,
          // Always use the patientEmail from server login response
          patientEmail: caregiverData.patientEmail
        };
        
        console.log("USING MERGED DATA from login + stored data");
        const validated = validateUserData(mergedData);
        
        // If there's a patient connection, verify it still exists
        if (validated.patientEmail) {
          console.log(`Verifying patient connection for caregiver: ${validated.email}`);
          
          // Use our safer verification method
          const patientExists = await verifyPatientConnection(validated.patientEmail, validated.token);
          
          if (patientExists === false) {  // Only disconnect if specifically returned false
            console.log(`Patient ${validated.patientEmail} no longer exists in the database (confirmed by server)`);
            
            // Use our safer disconnection method
            const disconnected = await disconnectFromPatient(validated.patientEmail, validated.email);
            
            // Only update validated data if disconnect was successful
            if (disconnected) {
              validated.patientEmail = null;
              
              // Also clear active patient if it's the same email
              if (activePatient && normalizeEmail(activePatient.email) === normalizeEmail(validated.patientEmail)) {
                console.log(`Clearing active patient reference`);
                setActivePatient(null);
                await AsyncStorage.removeItem(`activePatient_${validated.email}`);
              }
            }
          }
        }
        
        setCaregiver(validated);
        await saveCaregiverData(validated);
        
        // Verify active patient exists in connected patients - with better error handling
        try {
          // Get the active patient
          const activePatientKey = `activePatient_${validated.email}`;
          const storedActivePatient = await AsyncStorage.getItem(activePatientKey);
          
          if (storedActivePatient) {
            const activePatientData = JSON.parse(storedActivePatient);
            console.log(`Active patient: ${activePatientData.name || 'Unknown'}`);
            
            // Check if we have a valid patientEmail - if not, we can't have an active patient
            if (!validated.patientEmail) {
              console.log(`No patientEmail in validated data - cannot have active patient`);
              await AsyncStorage.removeItem(activePatientKey);
              setActivePatient(null);
            } else {
              // Set active patient anyway - the verified data should be correct
              setActivePatient(activePatientData);
            }
          }
        } catch (activePatientError) {
          console.log("Error verifying active patient:", activePatientError.message);
          // Continue with login, errors here shouldn't prevent login
        }
      } else {
        console.log("NO EXISTING CAREGIVER DATA - creating new profile");
        const validated = validateUserData(caregiverData);
        setCaregiver(validated);
        
        // Similarly check patient connection for new logins
        if (validated.patientEmail) {
          console.log(`New login - Verifying connected patient exists: ${validated.patientEmail}`);
          
          // Use our safer verification method instead of direct API calls
          const patientExists = await verifyPatientConnection(validated.patientEmail, validated.token);
          
          if (patientExists === false) {  // Only disconnect if specifically returned false
            console.log(`Patient ${validated.patientEmail} no longer exists - clearing connection (confirmed by server)`);
            validated.patientEmail = null;
            // Update in memory and save to storage
            setCaregiver({...validated});
          } else {
            console.log(`Verified patient ${validated.patientEmail} exists or couldn't be checked (offline)`);
          }
        }
        
        await saveCaregiverData(validated);
      }
      
      // Helper function for email normalization
      function normalizeEmail(email) {
        return email ? email.toLowerCase().trim() : '';
      }
      
      console.log("===== LOGIN CAREGIVER COMPLETE =====");
      return true;
    } catch (e) {
      console.log('Login error: Unable to complete login process', e.message);
      return false;
    }
  }, [saveCaregiverData, activePatient]);

  const updateCaregiver = useCallback(async (updates) => {
    try {
      if (!caregiver) throw new Error('No caregiver logged in');
      
      console.log(`Updating caregiver data for: ${caregiver.name || caregiver.email}`);
      if (updates.profileImage) {
        console.log("Profile image included in update:", updates.profileImage);
        // Ensure profile image is a string
        if (typeof updates.profileImage !== 'string') {
          console.log('Profile image is not a string! Converting...');
          updates.profileImage = String(updates.profileImage);
        }
      }
      
      const updatedCaregiver = {
        ...caregiver,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      setCaregiver(updatedCaregiver);
      const savedSuccessfully = await saveCaregiverData(updatedCaregiver);
      
      if (savedSuccessfully) {
        console.log("Caregiver data updated and saved successfully");
        
        // Create additional backups of profile image
        if (updatedCaregiver.profileImage) {
          try {
            await AsyncStorage.setItem(`caregiverHasProfileImage_${updatedCaregiver.email.toLowerCase().trim()}`, "true");
            await AsyncStorage.setItem(`caregiverProfileImagePath_${updatedCaregiver.email.toLowerCase().trim()}`, updatedCaregiver.profileImage);
            console.log("Created backup of profile image path");
          } catch (backupError) {
            console.log("Failed to create backup of profile image path - continuing anyway");
          }
        }
      } else {
        console.log("Failed to save updated caregiver data");
      }
      
      return savedSuccessfully;
    } catch (e) {
      console.log('Caregiver update error: Continuing with available data');
      return false;
    }
  }, [caregiver, saveCaregiverData]);

  const setActivePatientData = useCallback(async (patient) => {
    try {
      if (!caregiver) throw new Error('No caregiver logged in');
      
      // First check if auto-reactivation is blocked (added to prevent auto-reactivation)
      const blockAutoReactivation = await AsyncStorage.getItem('blockAutoReactivation');
      if (blockAutoReactivation === 'true' && patient) {
        console.log("Blocking automatic reactivation of patient due to recent deactivation");
        return false;
      }
      
      console.log(`Setting active patient: ${patient?.name || 'none'}`);
      
      if (patient) {
        // Check if this is an attempted auto-reactivation by comparing timestamps
        const lastDeactivation = await AsyncStorage.getItem('lastPatientDeactivation');
        if (lastDeactivation) {
          const lastDeactivationTime = parseInt(lastDeactivation.split('_')[1], 10);
          const currentTime = Date.now();
          // If deactivation was less than 3 seconds ago, block this activation
          if (currentTime - lastDeactivationTime < 3000) {
            console.log("Blocked auto-reactivation attempt (too soon after deactivation)");
            return false;
          }
        }
        
        // Save the active patient to AsyncStorage
        const activePatientKey = `activePatient_${caregiver.email}`;
        await AsyncStorage.setItem(activePatientKey, JSON.stringify(patient));
        setActivePatient(patient);
        
        // Trigger status update for any listeners
        setStatusUpdateTrigger(Date.now());
      } else {
        // Clear the active patient
        const activePatientKey = `activePatient_${caregiver.email}`;
        await AsyncStorage.removeItem(activePatientKey);
        setActivePatient(null);
        
        // Trigger status update for any listeners
        setStatusUpdateTrigger(Date.now());
      }
      
      return true;
    } catch (e) {
      console.log('Set active patient error: Continuing with available patient data');
      return false;
    }
  }, [caregiver]);

  const clearActivePatient = useCallback(async () => {
    try {
      if (!caregiver) throw new Error('No caregiver logged in');
      
      console.log("Clearing active patient");
      
      // Clear the active patient from state
      setActivePatient(null);
      
      // Set deactivation timestamp to track when patient was deactivated
      const currentTime = new Date().getTime();
      setDeactivationTime(currentTime);
      
      // Store the deactivation time in AsyncStorage to maintain after app restarts
      try {
        const deactivationKey = `patientDeactivationTime_${caregiver.email}`;
        await AsyncStorage.setItem(deactivationKey, JSON.stringify(currentTime));
      } catch (storageError) {
        console.log('Error storing deactivation time:', storageError.message);
      }
      
      // Clear the active patient from AsyncStorage
      const activePatientKey = `activePatient_${caregiver.email}`;
      await AsyncStorage.removeItem(activePatientKey);
      
      // Trigger status update for any listeners
      setStatusUpdateTrigger(Date.now());
      
      console.log("Active patient successfully cleared");
      return true;
    } catch (e) {
      console.log('Clear active patient error:', e.message);
      return false;
    }
  }, [caregiver]);

  // Add a function to refresh patient status - this will be used by screens to force a refresh
  const refreshPatientStatus = useCallback(async () => {
    try {
      console.log("Manual refresh of patient status requested");
      
      if (!caregiver?.email) {
        console.log("No caregiver logged in, cannot refresh patient status");
        return false;
      }
      
      // Check if there's an active patient in AsyncStorage
      const activePatientKey = `activePatient_${caregiver.email}`;
      const storedActivePatient = await AsyncStorage.getItem(activePatientKey);
      
      if (storedActivePatient) {
        // There's a patient in storage
        const patientData = JSON.parse(storedActivePatient);
        
        // Check if it's different from current active patient
        if (!activePatient || activePatient.email !== patientData.email) {
          console.log("AsyncStorage has different active patient than current state, updating state");
          setActivePatient(patientData);
        } else {
          console.log("Active patient in state matches AsyncStorage, no update needed");
        }
      } else if (activePatient) {
        // There's no patient in storage but we have one in state
        console.log("Active patient in state but not in AsyncStorage, clearing state");
        setActivePatient(null);
      }
      
      // Trigger a status update regardless to refresh any listeners
      setStatusUpdateTrigger(Date.now());
      
      return true;
    } catch (error) {
      console.log("Error refreshing patient status:", error.message);
      return false;
    }
  }, [caregiver, activePatient]);

  const logoutCaregiver = useCallback(async () => {
    try {
      console.log("===== LOGOUT CAREGIVER START =====");
      if (caregiver?.email) {
        console.log(`Logging out caregiver: ${caregiver.email}`);
        
        // Before logout, let's verify the data we have in AsyncStorage
        const key = `caregiverData_${caregiver.email.toLowerCase().trim()}`;
        const storedData = await AsyncStorage.getItem(key);
        
        if (storedData) {
          console.log("Found stored caregiver data, will be preserved for next login");
          const parsed = JSON.parse(storedData);
          console.log("Stored name:", parsed.name);
          console.log("Stored profile image:", parsed.profileImage ? "YES" : "NO");
          console.log("Stored medical info:", parsed.medicalInfo ? "YES" : "NO");
          if (parsed.medicalInfo) {
            console.log("Medical conditions:", parsed.medicalInfo.conditions ? "YES" : "NO");
            console.log("Medications:", parsed.medicalInfo.medications ? "YES" : "NO");
          }
        }
        
        // Note: We are NOT clearing activePatient here to preserve it between sessions
        console.log("Active patient preserved for next login:", activePatient?.name || "None");
      }
      
      setCaregiver(null);
      await AsyncStorage.removeItem("currentUserEmail");
      console.log("===== LOGOUT CAREGIVER COMPLETE =====");
      return true;
    } catch (e) {
      console.log('Logout error: Continuing with available data');
      return false;
    }
  }, [caregiver, activePatient]);

  return (
    <CaregiverContext.Provider
      value={{
        caregiver,
        isLoading,
        loginCaregiver,
        updateCaregiver,
        logoutCaregiver,
        activePatient,
        setActivePatient: setActivePatientData,
        clearActivePatient,
        refreshPatientStatus,
        statusUpdateTrigger,
        error
      }}
    >
      {children}
    </CaregiverContext.Provider>
  );
};

export const useCaregiver = () => {
  const context = useContext(CaregiverContext);
  if (!context) {
    throw new Error('useCaregiver must be used within a CaregiverProvider');
  }
  return context;
};