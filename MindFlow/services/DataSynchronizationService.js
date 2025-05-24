import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper function to normalize email addresses for consistent storage keys
const normalizeEmail = (email) => {
  return email ? email.toLowerCase().trim() : '';
};

// Main function to sync all data from caregiver to patient
export const syncPatientDataFromCaregiver = async (patientEmail, caregiverEmail) => {
  if (!patientEmail || !caregiverEmail) {
    console.log('Cannot sync: Missing patient or caregiver email');
    return false;
  }

  console.log(`Syncing data from caregiver ${caregiverEmail} to patient ${patientEmail}`);
  
  try {
    // Normalize emails for consistent key lookups
    const normalizedPatientEmail = normalizeEmail(patientEmail);
    const normalizedCaregiverEmail = normalizeEmail(caregiverEmail);
    
    // Check connection mapping to verify this is a valid caregiver-patient pair
    const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
    const mappings = JSON.parse(caregiverPatientsMap);
    
    // Verify the connection exists
    if (mappings[normalizedPatientEmail] !== normalizedCaregiverEmail) {
      console.log(`Invalid caregiver-patient connection: ${caregiverEmail} is not a caregiver for ${patientEmail}`);
      return false;
    }
    
    // 1. Sync reminders
    await syncReminders(normalizedPatientEmail, normalizedCaregiverEmail);
    
    // 2. Sync memories
    await syncMemories(normalizedPatientEmail, normalizedCaregiverEmail);
    
    // 3. Sync emergency contacts
    await syncEmergencyContacts(normalizedPatientEmail, normalizedCaregiverEmail);
    
    // 4. Sync home location
    await syncHomeLocation(normalizedPatientEmail, normalizedCaregiverEmail);
    
    // 5. Save last sync timestamp
    await AsyncStorage.setItem(`lastSync_${normalizedPatientEmail}`, new Date().toISOString());
    
    console.log(`Successfully completed data sync from caregiver ${caregiverEmail} to patient ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('Data synchronization failed:', error);
    return false;
  }
};

// Sync reminders from caregiver to patient
const syncReminders = async (patientEmail, caregiverEmail) => {
  try {
    // Check caregiver's reminders
    const caregiverKey = `reminders_${caregiverEmail}`;
    const caregiverRemindersData = await AsyncStorage.getItem(caregiverKey);
    
    if (!caregiverRemindersData) {
      console.log('No reminders found for caregiver');
      return;
    }
    
    // Parse caregiver reminders
    const allCaregiverReminders = JSON.parse(caregiverRemindersData);
    
    // Ensure allCaregiverReminders is an array
    if (!Array.isArray(allCaregiverReminders)) {
      console.error("Caregiver reminders is not an array");
      return;
    }
    
    console.log(`Found ${allCaregiverReminders.length} total reminders from caregiver`);
    
    // Filter to only include reminders for this specific patient
    const patientReminders = allCaregiverReminders.filter(reminder => 
      reminder && 
      reminder.forPatient && 
      reminder.forPatient.toLowerCase().trim() === patientEmail
    );
    
    console.log(`Filtered to ${patientReminders.length} reminders assigned to this patient`);
    
    // Update patient's reminders
    if (patientReminders.length > 0) {
      const patientStorageKey = `reminders_${patientEmail}`;
      
      // Save to patient's storage
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientReminders));
      console.log(`Synced ${patientReminders.length} reminders from caregiver to patient`);
    }
  } catch (error) {
    console.error('Error syncing reminders:', error);
  }
};

// Sync memories from caregiver to patient
const syncMemories = async (patientEmail, caregiverEmail) => {
  try {
    // Check caregiver's memories
    const caregiverKey = `memories_${caregiverEmail}`;
    const caregiverMemoriesData = await AsyncStorage.getItem(caregiverKey);
    
    if (!caregiverMemoriesData) {
      console.log('No memories found for caregiver');
      return;
    }
    
    // Parse caregiver memories
    const allCaregiverMemories = JSON.parse(caregiverMemoriesData);
    
    // Ensure allCaregiverMemories is an array
    if (!Array.isArray(allCaregiverMemories)) {
      console.error("Caregiver memories is not an array");
      return;
    }
    
    console.log(`Found ${allCaregiverMemories.length} total memories from caregiver`);
    
    // Filter to only include memories for this specific patient
    const patientMemories = allCaregiverMemories.filter(memory => 
      memory && 
      typeof memory === 'object' &&
      memory.forPatient && 
      typeof memory.forPatient === 'string' &&
      memory.forPatient.toLowerCase().trim() === patientEmail
    );
    
    console.log(`Filtered to ${patientMemories.length} memories assigned to this patient`);
    
    // Update patient's memories
    if (patientMemories.length > 0) {
      const patientStorageKey = `memories_${patientEmail}`;
      
      // Save to patient's storage
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientMemories));
      console.log(`Synced ${patientMemories.length} memories from caregiver to patient`);
    }
  } catch (error) {
    console.error('Error syncing memories:', error);
  }
};

// Sync emergency contacts from caregiver to patient
const syncEmergencyContacts = async (patientEmail, caregiverEmail) => {
  try {
    // Check caregiver's emergency contacts
    const caregiverKey = `emergencyContacts_${caregiverEmail}`;
    const caregiverContactsData = await AsyncStorage.getItem(caregiverKey);
    
    if (!caregiverContactsData) {
      console.log('No emergency contacts found for caregiver');
      return;
    }
    
    // Parse caregiver contacts
    const allCaregiverContacts = JSON.parse(caregiverContactsData);
    
    // Ensure allCaregiverContacts is an array
    if (!Array.isArray(allCaregiverContacts)) {
      console.error("Caregiver contacts is not an array");
      return;
    }
    
    console.log(`Found ${allCaregiverContacts.length} total emergency contacts from caregiver`);
    
    // Filter to only include contacts for this specific patient
    const patientContacts = allCaregiverContacts.filter(contact => 
      contact && 
      contact.forPatient && 
      contact.forPatient.toLowerCase().trim() === patientEmail
    );
    
    console.log(`Filtered to ${patientContacts.length} emergency contacts assigned to this patient`);
    
    // Update patient's contacts
    if (patientContacts.length > 0) {
      const patientStorageKey = `emergencyContacts_${patientEmail}`;
      
      // Save to patient's storage
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientContacts));
      console.log(`Synced ${patientContacts.length} emergency contacts from caregiver to patient`);
    }
  } catch (error) {
    console.error('Error syncing emergency contacts:', error);
  }
};

// Sync home location from caregiver to patient
const syncHomeLocation = async (patientEmail, caregiverEmail) => {
  try {
    // First check for patient-specific home location set by caregiver
    const caregiverPatientLocationKey = `patientHomeLocation_${caregiverEmail}_${patientEmail}`;
    const caregiverPatientLocationData = await AsyncStorage.getItem(caregiverPatientLocationKey);
    
    if (caregiverPatientLocationData) {
      // This is a patient-specific home location set by caregiver
      const homeLocation = JSON.parse(caregiverPatientLocationData);
      console.log(`Found patient-specific home location set by caregiver for ${patientEmail}`);
      
      // Get patient's user data to update home location
      const patientUserDataKey = `userData_${patientEmail}`;
      const patientUserData = await AsyncStorage.getItem(patientUserDataKey);
      
      if (patientUserData) {
        try {
          const patientData = JSON.parse(patientUserData);
          patientData.homeLocation = homeLocation;
          await AsyncStorage.setItem(patientUserDataKey, JSON.stringify(patientData));
          console.log(`Updated home location in patient user data for ${patientEmail}`);
        } catch (parseError) {
          console.error('Error parsing patient user data:', parseError);
        }
      }
      
      // Also save to direct home location key for MapScreen
      await AsyncStorage.setItem(`homeLocation_${patientEmail}`, JSON.stringify(homeLocation));
      console.log(`Saved home location to dedicated key for ${patientEmail}`);
      
      return true;
    } 
    else {
      // Check for caregiver's own data that might have patient home location
      const caregiverUserDataKey = `userData_${caregiverEmail}`;
      const caregiverUserData = await AsyncStorage.getItem(caregiverUserDataKey);
      
      if (caregiverUserData) {
        try {
          const userData = JSON.parse(caregiverUserData);
          
          // Check if caregiver has set a patient home location map
          if (userData.patientHomeLocations && 
              userData.patientHomeLocations[patientEmail]) {
            
            const homeLocation = userData.patientHomeLocations[patientEmail];
            console.log(`Found home location in caregiver's patientHomeLocations map for ${patientEmail}`);
            
            // Save to patient's user data
            const patientUserDataKey = `userData_${patientEmail}`;
            const patientUserData = await AsyncStorage.getItem(patientUserDataKey);
            
            if (patientUserData) {
              const patientData = JSON.parse(patientUserData);
              patientData.homeLocation = homeLocation;
              await AsyncStorage.setItem(patientUserDataKey, JSON.stringify(patientData));
              console.log(`Updated home location in patient user data for ${patientEmail}`);
            }
            
            // Also save to direct home location key for MapScreen
            await AsyncStorage.setItem(`homeLocation_${patientEmail}`, JSON.stringify(homeLocation));
            console.log(`Saved home location to dedicated key for ${patientEmail}`);
            
            return true;
          } else {
            console.log(`No patient home location found in caregiver's data for ${patientEmail}`);
          }
        } catch (parseError) {
          console.error('Error parsing caregiver user data:', parseError);
        }
      }
    }
    
    // No home location found for this patient
    console.log(`No home location found for patient ${patientEmail}`);
    return false;
  } catch (error) {
    console.error('Error syncing home location:', error);
    return false;
  }
};

// Function to check if data needs to be synced
export const checkNeedsSyncFromCaregiver = async (patientEmail) => {
  try {
    if (!patientEmail) return { needsSync: false, caregiverEmail: null };
    
    const normalizedEmail = normalizeEmail(patientEmail);
    
    // Check if patient has a caregiver
    const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
    const mappings = JSON.parse(caregiverPatientsMap);
    
    const caregiverEmail = mappings[normalizedEmail];
    if (!caregiverEmail) {
      // Removed logging here
      return { needsSync: false, caregiverEmail: null };
    }
    
    // Get last sync time
    const lastSyncStr = await AsyncStorage.getItem(`lastSync_${normalizedEmail}`);
    if (!lastSyncStr) {
      // Never synced before, needs sync
      return { needsSync: true, caregiverEmail };
    }
    
    try {
      // Parse the date safely
      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      
      // If last sync was more than 15 minutes ago, sync again
      const fifteenMinutes = 15 * 60 * 1000;
      if (now - lastSync > fifteenMinutes) {
        return { needsSync: true, caregiverEmail };
      }
    } catch (parseError) {
      console.error('Error parsing last sync time:', parseError);
      // If we can't parse the date, assume we need to sync
      // But first, clear the corrupted date
      await AsyncStorage.setItem(`lastSync_${normalizedEmail}`, new Date().toISOString());
      return { needsSync: true, caregiverEmail };
    }
    
    return { needsSync: false, caregiverEmail };
  } catch (error) {
    console.error('Error checking sync status:', error);
    return { needsSync: false, caregiverEmail: null };
  }
};

// Direct device-to-device profile data sharing
export const shareProfileDataDirectly = async (patientEmail, caregiverEmail) => {
  try {
    console.log(`Sharing profile data directly: Patient ${patientEmail} to Caregiver ${caregiverEmail}`);
    
    if (!patientEmail || !caregiverEmail) {
      console.log('Missing email(s), cannot share profile data');
      return { success: false, error: 'Missing email(s)' };
    }
    
    const normalizedPatientEmail = patientEmail.toLowerCase().trim();
    const normalizedCaregiverEmail = caregiverEmail.toLowerCase().trim();
    
    // Get patient data from all possible sources
    const patientDataKeys = [
      `userData_${normalizedPatientEmail}`,
      `directPatientData_${normalizedPatientEmail}`,
      `syncedUserData_${normalizedPatientEmail}`,
      `userProfile_${normalizedPatientEmail}`,
      `patientData_${normalizedPatientEmail}`
    ];
    
    let bestPatientData = null;
    let bestDataSource = null;
    
    // First, get the most complete patient data available
    for (const key of patientDataKeys) {
      try {
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          const data = JSON.parse(dataStr);
          
          // Check if this data has name (required for patient display)
          if (data && data.email && data.name) {
            console.log(`Found valid patient data in ${key} with name: ${data.name}`);
            
            // If we don't have data yet, or this data is more complete
            if (!bestPatientData || 
                (data.name && !bestPatientData.name) ||
                (data.profileImage && !bestPatientData.profileImage) ||
                (data.medicalInfo && !bestPatientData.medicalInfo)) {
              
              bestPatientData = data;
              bestDataSource = key;
            }
          }
        }
      } catch (error) {
        console.log(`Error checking patient data key ${key}:`, error.message);
      }
    }
    
    if (!bestPatientData) {
      console.log('No valid patient data found for sharing');
      return { success: false, error: 'No valid patient data found' };
    }
    
    console.log(`Using best patient data from ${bestDataSource} for sharing`);
    
    // Ensure the data has required fields
    const patientDataToShare = {
      id: bestPatientData.id || `patient-${Date.now()}`,
      email: normalizedPatientEmail,
      name: bestPatientData.name,
      profileImage: bestPatientData.profileImage || null,
      phone: bestPatientData.phone || '',
      address: bestPatientData.address || '',
      medicalInfo: bestPatientData.medicalInfo || {},
      caregiverEmail: normalizedCaregiverEmail,
      lastUpdate: new Date().toISOString()
    };
    
    // Update mapping in caregiverPatientsMap
    try {
      const mappingKey = 'caregiverPatientsMap';
      const mappingStr = await AsyncStorage.getItem(mappingKey) || '{}';
      let mappings = JSON.parse(mappingStr);
      
      // Update bidirectional mapping
      mappings[normalizedPatientEmail] = normalizedCaregiverEmail;
      mappings[`caregiver_${normalizedCaregiverEmail}`] = mappings[`caregiver_${normalizedCaregiverEmail}`] || [];
      
      if (!mappings[`caregiver_${normalizedCaregiverEmail}`].includes(normalizedPatientEmail)) {
        mappings[`caregiver_${normalizedCaregiverEmail}`].push(normalizedPatientEmail);
      }
      
      await AsyncStorage.setItem(mappingKey, JSON.stringify(mappings));
      console.log(`Updated caregiverPatientsMap for connection between ${normalizedPatientEmail} and ${normalizedCaregiverEmail}`);
    } catch (error) {
      console.log('Error updating mapping:', error.message);
    }
    
    // Now save the patient data to ALL possible caregiver access points
    try {
      // 1. Direct patient data key
      await AsyncStorage.setItem(`patientData_${normalizedPatientEmail}`, 
        JSON.stringify(patientDataToShare));
      
      // 2. Save to caregiver's list of patients
      const caregiverPatientsKey = `connectedPatients_${normalizedCaregiverEmail}`;
      let patientsList = [];
      
      try {
        const patientsStr = await AsyncStorage.getItem(caregiverPatientsKey);
        if (patientsStr) {
          patientsList = JSON.parse(patientsStr);
        }
      } catch (error) {
        console.log('Error getting caregiver patients list:', error.message);
      }
      
      // Find patient in list or add them
      const existingPatientIndex = patientsList.findIndex(p => 
        p.email && (p.email.toLowerCase().trim() === normalizedPatientEmail));
      
      if (existingPatientIndex >= 0) {
        console.log(`Updating existing patient in caregiver's list, index: ${existingPatientIndex}`);
        // Update with new data but preserve any caregiver-specific fields
        patientsList[existingPatientIndex] = {
          ...patientsList[existingPatientIndex],
          name: patientDataToShare.name,
          profileImage: patientDataToShare.profileImage,
          phone: patientDataToShare.phone,
          medicalInfo: patientDataToShare.medicalInfo,
          lastUpdate: patientDataToShare.lastUpdate
        };
      } else {
        console.log(`Adding new patient to caregiver's list`);
        // Add new patient to list
        patientsList.push(patientDataToShare);
      }
      
      await AsyncStorage.setItem(caregiverPatientsKey, JSON.stringify(patientsList));
      console.log(`Saved updated patient list for caregiver, patients: ${patientsList.length}`);
      
      // 3. Also save to caregiver-specific patient key for direct access
      const caregiverPatientKey = `caregiverPatient_${normalizedCaregiverEmail}_${normalizedPatientEmail}`;
      await AsyncStorage.setItem(caregiverPatientKey, JSON.stringify(patientDataToShare));
      console.log(`Saved to caregiver-specific patient key: ${caregiverPatientKey}`);
      
      return { 
        success: true, 
        message: `Profile data shared from ${normalizedPatientEmail} to ${normalizedCaregiverEmail}` 
      };
    } catch (error) {
      console.log('Error saving shared profile data:', error.message);
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.log('Error in shareProfileDataDirectly:', error.message);
    return { success: false, error: error.message };
  }
};

export const syncAllUserData = async (userEmail) => {
  try {
    console.log(`Syncing all user data for: ${userEmail}`);
    
    // 1. First check if this user is a patient with a caregiver
    const caregiverPatientsMapStr = await AsyncStorage.getItem('caregiverPatientsMap');
    if (caregiverPatientsMapStr) {
      const mappings = JSON.parse(caregiverPatientsMapStr);
      const caregiverEmail = mappings[userEmail];
      
      if (caregiverEmail) {
        console.log(`User is a patient with caregiver: ${caregiverEmail}`);
        // Share patient data with caregiver
        await shareProfileDataDirectly(userEmail, caregiverEmail);
        // Force update caregiver's connected patients list
        await forceSyncPatientNameToCaregiver(userEmail, caregiverEmail);
      }
    }
    
    // Other sync operations can be implemented here
    
    return { success: true };
  } catch (error) {
    console.log(`Error in syncAllUserData: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// New function to force update caregiver's patient list with the correct patient name
export const forceSyncPatientNameToCaregiver = async (patientEmail, caregiverEmail) => {
  try {
    console.log(`FORCE SYNCING PATIENT NAME: ${patientEmail} to caregiver ${caregiverEmail}`);
    
    const normalizedPatientEmail = patientEmail.toLowerCase().trim();
    const normalizedCaregiverEmail = caregiverEmail.toLowerCase().trim();
    
    // Get the most accurate patient name from all possible sources
    const patientDataKeys = [
      `userData_${normalizedPatientEmail}`,
      `directPatientData_${normalizedPatientEmail}`,
      `syncedUserData_${normalizedPatientEmail}`,
      `userProfile_${normalizedPatientEmail}`,
      `patientData_${normalizedPatientEmail}`
    ];
    
    // Find the best name across all sources
    let bestName = null;
    let bestNameSource = null;
    
    for (const key of patientDataKeys) {
      try {
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          const data = JSON.parse(dataStr);
          if (data && data.name && data.name.trim() !== '') {
            // If this is our first name or it's a better one (longer), use it
            if (!bestName || data.name.trim().length > bestName.trim().length) {
              bestName = data.name;
              bestNameSource = key;
              console.log(`Found better name in ${key}: ${bestName}`);
            }
          }
        }
      } catch (error) {
        console.log(`Error checking key ${key}: ${error.message}`);
      }
    }
    
    // If no name found, try to derive from email
    if (!bestName) {
      bestName = normalizedPatientEmail.split('@')[0]
        .split(/[.\-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      console.log(`No name found in any storage, using derived name: ${bestName}`);
    } else {
      console.log(`Best patient name found: ${bestName} from ${bestNameSource}`);
    }
    
    // Now update ALL caregiver-related keys with this best name
    
    // 1. Update the connectedPatients list
    const connectedPatientsKey = `connectedPatients_${normalizedCaregiverEmail}`;
    try {
      const patientsListStr = await AsyncStorage.getItem(connectedPatientsKey);
      if (patientsListStr) {
        let patientsList = JSON.parse(patientsListStr);
        
        // Find the patient in the list
        const patientIndex = patientsList.findIndex(p => 
          p.email && p.email.toLowerCase().trim() === normalizedPatientEmail);
        
        if (patientIndex >= 0) {
          console.log(`Found patient at index ${patientIndex}, updating name to: ${bestName}`);
          
          // Update the name while preserving all other fields
          patientsList[patientIndex] = {
            ...patientsList[patientIndex],
            name: bestName
          };
          
          // Save the updated list
          await AsyncStorage.setItem(connectedPatientsKey, JSON.stringify(patientsList));
          console.log(`Updated patient name in caregiver's list to: ${bestName}`);
        } else {
          console.log(`Patient not found in caregiver's list`);
        }
      } else {
        console.log(`No connected patients list found for caregiver: ${normalizedCaregiverEmail}`);
      }
    } catch (error) {
      console.log(`Error updating caregiver's patient list: ${error.message}`);
    }
    
    // 2. Update any individual patient data keys the caregiver might be using
    const caregiverPatientKeys = [
      `patientData_${normalizedPatientEmail}`,
      `directPatientData_${normalizedPatientEmail}`,
      `caregiverPatient_${normalizedCaregiverEmail}_${normalizedPatientEmail}`,
      `patient_${normalizedPatientEmail}`
    ];
    
    for (const key of caregiverPatientKeys) {
      try {
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          const data = JSON.parse(dataStr);
          
          // Update the name and save back
          data.name = bestName;
          await AsyncStorage.setItem(key, JSON.stringify(data));
          console.log(`Updated patient name in ${key} to: ${bestName}`);
        }
      } catch (error) {
        console.log(`Error updating key ${key}: ${error.message}`);
      }
    }
    
    // 3. Also update any special keys the caregiver app might be using
    try {
      const activePatientKey = `activePatient_${normalizedCaregiverEmail}`;
      const activePatientStr = await AsyncStorage.getItem(activePatientKey);
      
      if (activePatientStr) {
        try {
          const activePatient = JSON.parse(activePatientStr);
          if (activePatient.email && activePatient.email.toLowerCase().trim() === normalizedPatientEmail) {
            // Update active patient name
            activePatient.name = bestName;
            await AsyncStorage.setItem(activePatientKey, JSON.stringify(activePatient));
            console.log(`Updated active patient name for caregiver to: ${bestName}`);
          }
        } catch (error) {
          console.log(`Error updating active patient: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`Error checking active patient: ${error.message}`);
    }
    
    return { success: true, updatedName: bestName };
  } catch (error) {
    console.log(`Error in forceSyncPatientNameToCaregiver: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Missing function implementation - add this before forceSyncPatientDataAndName
// Function to force sync patient data to caregiver
export const forceSyncPatientDataToCaregiver = async (patientEmail, caregiverEmail) => {
  try {
    console.log(`FORCE SYNC PATIENT DATA: ${patientEmail} -> ${caregiverEmail}`);
    const normalizedPatientEmail = patientEmail.toLowerCase().trim();
    const normalizedCaregiverEmail = caregiverEmail.toLowerCase().trim();
    
    // Get all patient data from all possible sources
    const patientDataKeys = [
      `userData_${normalizedPatientEmail}`,
      `directPatientData_${normalizedPatientEmail}`,
      `syncedUserData_${normalizedPatientEmail}`,
      `userProfile_${normalizedPatientEmail}`,
      `patientData_${normalizedPatientEmail}`
    ];
    
    // Find the best patient data
    let bestPatientData = null;
    let bestDataSource = null;
    
    for (const key of patientDataKeys) {
      try {
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          const data = JSON.parse(dataStr);
          if (data && data.email) {
            // If we don't have data yet, or this data is more complete, use it
            const hasName = data.name && data.name.trim() !== '';
            const hasImage = !!data.profileImage;
            const hasMedicalInfo = !!data.medicalInfo;
            
            const score = (hasName ? 3 : 0) + (hasImage ? 2 : 0) + (hasMedicalInfo ? 1 : 0);
            const currentScore = bestPatientData ? 
              ((bestPatientData.name ? 3 : 0) + 
               (bestPatientData.profileImage ? 2 : 0) + 
               (bestPatientData.medicalInfo ? 1 : 0)) : -1;
            
            if (score > currentScore) {
              bestPatientData = data;
              bestDataSource = key;
              console.log(`Found better patient data in ${key} - score: ${score}`);
            }
          }
        }
      } catch (error) {
        console.log(`Error checking key ${key}: ${error.message}`);
      }
    }
    
    if (!bestPatientData) {
      console.log(`No valid patient data found for ${normalizedPatientEmail}`);
      return false;
    }
    
    console.log(`Using best patient data from ${bestDataSource} - name: ${bestPatientData.name || 'unknown'}`);
    
    // Ensure we have a name
    if (!bestPatientData.name || bestPatientData.name.trim() === '') {
      bestPatientData.name = normalizedPatientEmail.split('@')[0]
        .split(/[.\-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      console.log(`Using derived name for patient: ${bestPatientData.name}`);
    }
    
    // Now update all caregiver-specific keys
    const caregiverPatientKeys = [
      `patientData_${normalizedPatientEmail}`,
      `directPatientData_${normalizedPatientEmail}`,
      `syncedUserData_${normalizedPatientEmail}`,
      `userProfile_${normalizedPatientEmail}`,
      `caregiverPatient_${normalizedCaregiverEmail}_${normalizedPatientEmail}`
    ];
    
    // Special handling for the connectedPatients list
    try {
      const connectedPatientsKey = `connectedPatients_${normalizedCaregiverEmail}`;
      const patientsListStr = await AsyncStorage.getItem(connectedPatientsKey);
      
      if (patientsListStr) {
        let patientsList = JSON.parse(patientsListStr);
        const patientIndex = patientsList.findIndex(p => 
          p.email && p.email.toLowerCase().trim() === normalizedPatientEmail);
        
        if (patientIndex >= 0) {
          // Update this patient in the list
          patientsList[patientIndex] = {
            ...patientsList[patientIndex],
            name: bestPatientData.name,
            id: bestPatientData.id || patientsList[patientIndex].id || `patient-${Date.now()}`,
            profileImage: bestPatientData.profileImage || patientsList[patientIndex].profileImage,
            phone: bestPatientData.phone || patientsList[patientIndex].phone || '',
            medicalInfo: bestPatientData.medicalInfo || patientsList[patientIndex].medicalInfo || {},
            lastUpdate: new Date().toISOString()
          };
          
          await AsyncStorage.setItem(connectedPatientsKey, JSON.stringify(patientsList));
          console.log(`Updated patient in connectedPatients list with name: ${bestPatientData.name}`);
        } else {
          // Patient not in the list, add them
          patientsList.push({
            id: bestPatientData.id || `patient-${Date.now()}`,
            email: normalizedPatientEmail,
            name: bestPatientData.name,
            profileImage: bestPatientData.profileImage || null,
            phone: bestPatientData.phone || '',
            medicalInfo: bestPatientData.medicalInfo || {},
            lastUpdate: new Date().toISOString()
          });
          
          await AsyncStorage.setItem(connectedPatientsKey, JSON.stringify(patientsList));
          console.log(`Added patient to connectedPatients list with name: ${bestPatientData.name}`);
        }
      } else {
        // Create a new list with just this patient
        const patientsList = [{
          id: bestPatientData.id || `patient-${Date.now()}`,
          email: normalizedPatientEmail,
          name: bestPatientData.name,
          profileImage: bestPatientData.profileImage || null,
          phone: bestPatientData.phone || '',
          medicalInfo: bestPatientData.medicalInfo || {},
          lastUpdate: new Date().toISOString()
        }];
        
        await AsyncStorage.setItem(connectedPatientsKey, JSON.stringify(patientsList));
        console.log(`Created new connectedPatients list with patient: ${bestPatientData.name}`);
      }
    } catch (error) {
      console.log(`Error updating connectedPatients list: ${error.message}`);
    }
    
    // Update individual patient keys
    for (const key of caregiverPatientKeys) {
      try {
        // Check if key already exists
        const existingDataStr = await AsyncStorage.getItem(key);
        
        if (existingDataStr) {
          try {
            const existingData = JSON.parse(existingDataStr);
            
            // Only update if this is the right patient
            if (existingData.email && existingData.email.toLowerCase().trim() === normalizedPatientEmail) {
              // Update the name and other important fields
              existingData.name = bestPatientData.name;
              existingData.profileImage = bestPatientData.profileImage || existingData.profileImage;
              existingData.lastUpdate = new Date().toISOString();
              
              // Save back to storage
              await AsyncStorage.setItem(key, JSON.stringify(existingData));
              console.log(`Updated patient name in ${key}: ${bestPatientData.name}`);
            }
          } catch (error) {
            console.log(`Error updating ${key}: ${error.message}`);
          }
        } else {
          // Key doesn't exist, create it with minimal data
          const newData = {
            id: bestPatientData.id || `patient-${Date.now()}`,
            email: normalizedPatientEmail,
            name: bestPatientData.name,
            profileImage: bestPatientData.profileImage || null,
            phone: bestPatientData.phone || '',
            lastUpdate: new Date().toISOString()
          };
          
          await AsyncStorage.setItem(key, JSON.stringify(newData));
          console.log(`Created new patient data in ${key}: ${bestPatientData.name}`);
        }
      } catch (error) {
        console.log(`Error processing ${key}: ${error.message}`);
      }
    }
    
    // Update the active patient if needed
    try {
      const activePatientKey = `activePatient_${normalizedCaregiverEmail}`;
      const activePatientStr = await AsyncStorage.getItem(activePatientKey);
      
      if (activePatientStr) {
        const activePatient = JSON.parse(activePatientStr);
        if (activePatient.email && 
            activePatient.email.toLowerCase().trim() === normalizedPatientEmail) {
          // This is the active patient, update it
          activePatient.name = bestPatientData.name;
          activePatient.profileImage = bestPatientData.profileImage || activePatient.profileImage;
          activePatient.lastUpdate = new Date().toISOString();
          
          await AsyncStorage.setItem(activePatientKey, JSON.stringify(activePatient));
          console.log(`Updated active patient name: ${bestPatientData.name}`);
        }
      }
    } catch (error) {
      console.log(`Error updating active patient: ${error.message}`);
    }
    
    // Set a flag to indicate this patient has been force synced
    const syncFlagKey = `forceSynced_${normalizedPatientEmail}_${normalizedCaregiverEmail}`;
    await AsyncStorage.setItem(syncFlagKey, new Date().toISOString());
    
    return true;
  } catch (error) {
    console.log(`Error in forceSyncPatientDataToCaregiver: ${error.message}`);
    return false;
  }
};

// Add a new function to ensure all patient data is synced
export const forceSyncPatientDataAndName = async (patientEmail) => {
  try {
    console.log(`Force syncing all data for patient: ${patientEmail}`);
    const normalizedEmail = patientEmail.toLowerCase().trim();
    
    // First, find this patient's caregiver from the mapping
    const mappingKey = 'caregiverPatientsMap';
    const mappingStr = await AsyncStorage.getItem(mappingKey) || '{}';
    const mappings = JSON.parse(mappingStr);
    const caregiverEmail = mappings[normalizedEmail];
    
    if (!caregiverEmail) {
      console.log(`No caregiver found for patient ${normalizedEmail}`);
      return { success: false, error: 'No caregiver association found' };
    }
    
    console.log(`Found caregiver ${caregiverEmail} for patient ${normalizedEmail}`);
    
    // Step 1: Use the ServerSyncService to get the best patient name
    try {
      // Import dynamically to avoid circular dependencies
      const { fetchPatientName } = require('./ServerSyncService');
      const nameResult = await fetchPatientName(normalizedEmail);
      
      if (nameResult.success && nameResult.name) {
        console.log(`Found best name for patient: ${nameResult.name} (from ${nameResult.source})`);
        
        // Step 2: Sync this name to all storage locations
        await forceSyncPatientNameToCaregiver(normalizedEmail, caregiverEmail);
        
        // Step 3: Force sync all patient data
        await forceSyncPatientDataToCaregiver(normalizedEmail, caregiverEmail);
        
        return { 
          success: true, 
          name: nameResult.name,
          message: `Successfully synchronized patient data for ${nameResult.name}`
        };
      } else {
        console.log(`Could not find name for patient ${normalizedEmail}`);
        
        // Still try to sync any data we have
        await forceSyncPatientDataToCaregiver(normalizedEmail, caregiverEmail);
        
        return { 
          success: false, 
          error: 'Could not find patient name'
        };
      }
    } catch (error) {
      console.log(`Error fetching patient name: ${error.message}`);
      
      // Try to sync with whatever data we have
      await forceSyncPatientDataToCaregiver(normalizedEmail, caregiverEmail);
      
      return { 
        success: false, 
        error: `Error fetching name: ${error.message}` 
      };
    }
  } catch (error) {
    console.log(`Error in forceSyncPatientDataAndName: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Add this function at the bottom of the file, just before the export default
export const ensureConsistentUserNames = async () => {
  try {
    console.log("Ensuring name consistency across all storage keys...");
    
    // Step 1: Get all user emails from various storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Got ${allKeys.length} total AsyncStorage keys`);
    
    // Find all userData keys to identify users
    const userDataKeys = allKeys.filter(key => key.startsWith('userData_'));
    console.log(`Found ${userDataKeys.length} user data keys`);
    
    const emailSet = new Set();
    
    // Get emails from userData keys
    for (const key of userDataKeys) {
      const email = key.replace('userData_', '');
      if (isValidEmail(email)) {
        emailSet.add(email);
      }
    }
    
    console.log(`Found ${emailSet.size} unique user emails`);
    
    // Step 2: For each email, find and reconcile names
    for (const email of emailSet) {
      console.log(`Reconciling names for user: ${email}`);
      
      try {
        // Import the specialized function dynamically
        const { fetchPatientName } = require('./ServerSyncService');
        
        // Get the best name for this user
        const nameResult = await fetchPatientName(email);
        
        if (nameResult.success) {
          console.log(`Best name for ${email}: ${nameResult.name} (score: ${nameResult.score}, source: ${nameResult.source})`);
          
          // Verify if the name is synchronized across different storage places
          const keysToCheck = [
            `userData_${email}`,
            `directPatientData_${email}`,
            `patientData_${email}`,
            `syncedUserData_${email}`
          ];
          
          let inconsistenciesFound = false;
          
          for (const key of keysToCheck) {
            try {
              const dataStr = await AsyncStorage.getItem(key);
              if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.name !== nameResult.name) {
                  console.log(`Name mismatch in ${key}: "${data.name}" vs best name "${nameResult.name}"`);
                  inconsistenciesFound = true;
                  
                  // Update to the best name
                  data.name = nameResult.name;
                  await AsyncStorage.setItem(key, JSON.stringify(data));
                  console.log(`Updated ${key} with consistent name: ${nameResult.name}`);
                }
              }
            } catch (error) {
              console.log(`Error checking ${key}: ${error.message}`);
            }
          }
          
          // Check if this user is a patient associated with a caregiver
          const mappingKey = 'caregiverPatientsMap';
          const mappingsStr = await AsyncStorage.getItem(mappingKey) || '{}';
          const mappings = JSON.parse(mappingsStr);
          const caregiverEmail = mappings[email];
          
          if (caregiverEmail) {
            console.log(`User ${email} is a patient with caregiver ${caregiverEmail}`);
            
            // Force sync the patient name to caregiver lists
            await forceSyncPatientNameToCaregiver(email, caregiverEmail);
            
            // Also check the activePatient
            const activePatientKey = `activePatient_${caregiverEmail}`;
            const activePatientStr = await AsyncStorage.getItem(activePatientKey);
            
            if (activePatientStr) {
              try {
                const activePatient = JSON.parse(activePatientStr);
                if (activePatient.email === email && activePatient.name !== nameResult.name) {
                  console.log(`Updating active patient name from "${activePatient.name}" to "${nameResult.name}"`);
                  activePatient.name = nameResult.name;
                  await AsyncStorage.setItem(activePatientKey, JSON.stringify(activePatient));
                }
              } catch (error) {
                console.log(`Error updating active patient: ${error.message}`);
              }
            }
          }
          
          if (inconsistenciesFound) {
            console.log(`Name inconsistencies resolved for ${email}`);
          } else {
            console.log(`Names already consistent for ${email}`);
          }
        } else {
          console.log(`Could not determine best name for ${email}: ${nameResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`Error processing ${email}: ${error.message}`);
      }
    }
    
    return { success: true, message: `Completed name consistency check for ${emailSet.size} users` };
  } catch (error) {
    console.log(`Error in ensureConsistentUserNames: ${error.message}`);
    return { success: false, error: error.message };
  }
};

export default {
  syncPatientDataFromCaregiver,
  syncReminders,
  syncMemories,
  syncEmergencyContacts,
  syncHomeLocation,
  checkNeedsSyncFromCaregiver,
  shareProfileDataDirectly,
  syncAllUserData,
  forceSyncPatientNameToCaregiver,
  forceSyncPatientDataToCaregiver,
  forceSyncPatientDataAndName,
  ensureConsistentUserNames
}; 