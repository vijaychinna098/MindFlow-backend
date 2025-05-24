// Test script to manually trigger synchronization between caregiver and patient
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncPatientDataFromCaregiver } from '../services/DataSynchronizationService';

/**
 * This script can be run to manually test the synchronization between 
 * a caregiver and a patient. It can be called from DevTools or other testing utilities.
 * 
 * @param {string} patientEmail - The email of the patient account
 * @param {string} caregiverEmail - The email of the caregiver account
 * @returns {Promise<boolean>} - Whether the sync was successful
 */
export const testSynchronization = async (patientEmail, caregiverEmail) => {
  if (!patientEmail || !caregiverEmail) {
    console.error('Both patient and caregiver emails are required for synchronization test');
    return false;
  }
  
  try {
    console.log(`Running test synchronization from caregiver ${caregiverEmail} to patient ${patientEmail}`);
    
    // Normalize emails
    const normalizedPatientEmail = patientEmail.toLowerCase().trim();
    const normalizedCaregiverEmail = caregiverEmail.toLowerCase().trim();
    
    // First, ensure the mapping exists
    const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
    const mappings = JSON.parse(caregiverPatientsMap);
    
    // Check if a connection already exists
    if (mappings[normalizedPatientEmail] !== normalizedCaregiverEmail) {
      console.log('Connection does not exist. Creating temporary connection for testing...');
      
      // Create a temporary connection for testing
      mappings[normalizedPatientEmail] = normalizedCaregiverEmail;
      mappings[`caregiver_${normalizedCaregiverEmail}`] = mappings[`caregiver_${normalizedCaregiverEmail}`] || [];
      
      if (!mappings[`caregiver_${normalizedCaregiverEmail}`].includes(normalizedPatientEmail)) {
        mappings[`caregiver_${normalizedCaregiverEmail}`].push(normalizedPatientEmail);
      }
      
      await AsyncStorage.setItem('caregiverPatientsMap', JSON.stringify(mappings));
      console.log('Temporary connection created');
    }
    
    // Now perform the synchronization
    const syncResult = await syncPatientDataFromCaregiver(normalizedPatientEmail, normalizedCaregiverEmail);
    
    if (syncResult) {
      console.log('Test synchronization completed successfully');
    } else {
      console.error('Test synchronization failed');
    }
    
    return syncResult;
  } catch (error) {
    console.error('Error during test synchronization:', error);
    return false;
  }
}; 