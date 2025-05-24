import axios from 'axios';
import { BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Send an emergency location alert email to the caregiver
 * @param {Object} patient - The patient user object
 * @param {Object} caregiver - The caregiver object with name and email
 * @param {number} distance - Distance from home in meters
 * @param {Object} currentLocation - The current location coordinates
 * @param {boolean} forceSend - Force send even if alert was already sent today
 * @returns {Promise<boolean>} - Whether the email was sent successfully
 */
export const sendLocationAlertEmail = async (patient, caregiver, distance, currentLocation, forceSend = false) => {
  try {
    if (!patient || !patient.email) {
      console.error('Missing patient information for location alert email');
      return false;
    }
    
    if (!caregiver || !caregiver.email) {
      console.error('Missing caregiver information for location alert email');
      return false;
    }

    console.log(`Preparing location alert email to caregiver: ${caregiver.email}`);
    console.log(`Patient: ${patient.name || patient.email}`);
    console.log(`Distance from home: ${Math.round(distance)} meters`);
    
    const patientName = patient.name || patient.email;
    const caregiverName = caregiver.name || 'Caregiver';
    
    // Round distance to nearest meter
    const roundedDistance = Math.round(distance);
    
    // Format the current timestamp
    const timestamp = new Date().toLocaleString();
    
    // Create the email text
    const emailSubject = `${patientName} is ${roundedDistance}m away from home`;
    
    const emailText = `
Hello ${caregiverName},

${patientName} is currently ${roundedDistance} meters away from home. Please contact user.

Location detected at: ${timestamp}

This is an automated alert from the Alzheimer's App.
    `;
    
    // Store the alert in AsyncStorage to prevent duplicate alerts
    const alertKey = `locationAlert_${patient.email}_${new Date().toISOString().split('T')[0]}`;
    let shouldSendAlert = true;
    
    if (!forceSend) {
      const lastAlertTime = await AsyncStorage.getItem(alertKey);
      
      // Only send an alert if we haven't sent one in the last hour
      if (lastAlertTime) {
        const timeSinceLastAlert = Date.now() - parseInt(lastAlertTime);
        const oneHourInMs = 60 * 60 * 1000;
        
        if (timeSinceLastAlert < oneHourInMs) {
          console.log(`Skipping location alert: last alert was sent ${Math.round(timeSinceLastAlert / 60000)} minutes ago`);
          shouldSendAlert = false;
        }
      }
    } else {
      console.log('Force sending alert, bypassing time limitation check');
    }
    
    if (shouldSendAlert) {
      // Attempt to send the email
      console.log(`Sending email to ${caregiver.email} with subject: ${emailSubject}`);
      console.log(`Email API endpoint: ${BASE_URL}/api/email/send-email`);
      
      let emailSuccess = false;
      try {
        const response = await axios.post(`${BASE_URL}/api/email/send-email`, {
          to: caregiver.email,
          subject: emailSubject,
          text: emailText
        });
        
        console.log('Email API response:', response.data);
        
        if (response.data.success) {
          console.log('Location alert email sent successfully');
          emailSuccess = true;
        } else {
          console.error('Failed to send location alert email:', response.data.message);
        }
      } catch (emailError) {
        console.error('Error sending location alert email via API:', emailError);
        // If the error has a response, log it for debugging
        if (emailError.response) {
          console.error('API error response:', emailError.response.data);
        }
      }
      
      // Also create an in-app notification for the caregiver
      console.log('Creating in-app notification for caregiver');
      const notificationSuccess = await addCaregiverNotification(
        caregiver,
        emailSubject,
        `Hello ${caregiverName}, ${patientName} is ${roundedDistance}m away from home. Please contact user.`,
        {
          type: 'location_alert',
          patientEmail: patient.email,
          distance: roundedDistance,
          timestamp: new Date().toISOString()
        }
      );
      
      console.log(`In-app notification created: ${notificationSuccess ? 'Success' : 'Failed'}`);
      
      // If either notification method succeeded, store the last alert time
      if (emailSuccess || notificationSuccess) {
        await AsyncStorage.setItem(alertKey, Date.now().toString());
        console.log('Alert timestamp stored to prevent duplicates');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in sendLocationAlertEmail:', error);
    return false;
  }
};

/**
 * Add an in-app notification for the caregiver
 * @param {Object} caregiver - The caregiver object with email
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional notification data
 * @returns {Promise<boolean>} - Whether the notification was created successfully
 */
export const addCaregiverNotification = async (caregiver, title, message, data = {}) => {
  try {
    if (!caregiver || !caregiver.email) {
      console.error('Caregiver information missing for notification');
      return false;
    }
    
    // Create notification key for this caregiver
    const notificationsKey = `caregiverNotifications_${caregiver.email.toLowerCase().trim()}`;
    
    // Get existing notifications
    const existingNotifications = await AsyncStorage.getItem(notificationsKey);
    const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
    
    // Add new notification at the beginning of the array
    notifications.unshift({
      id: Date.now().toString(),
      title,
      message,
      data,
      read: false,
      timestamp: new Date().toISOString()
    });
    
    // Limit to 50 notifications
    if (notifications.length > 50) {
      notifications.splice(50);
    }
    
    // Save updated notifications
    await AsyncStorage.setItem(notificationsKey, JSON.stringify(notifications));
    console.log(`Added notification for caregiver (${caregiver.email}): ${title}`);
    
    return true;
  } catch (error) {
    console.error('Error adding caregiver notification:', error);
    return false;
  }
};

/**
 * Calculate distance between two geographic coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Haversine formula to calculate distance between two points
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance); // Returns distance in meters, rounded
};

/**
 * Check if a user is outside the safe zone
 * @param {Object} currentLocation - Current location coordinates {latitude, longitude}
 * @param {Object} homeLocation - Home location coordinates {latitude, longitude}
 * @param {number} safeDistance - Safe distance in meters
 * @returns {boolean} - Whether the user is outside the safe zone
 */
export const isOutsideSafeZone = (currentLocation, homeLocation, safeDistance) => {
  if (!currentLocation || !homeLocation) return false;
  
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    homeLocation.latitude,
    homeLocation.longitude
  );
  
  return distance > safeDistance;
};

/**
 * Get the connected caregiver for a patient
 * @param {Object} user - The patient user object
 * @returns {Promise<Object|null>} - The caregiver object or null
 */
export const getConnectedCaregiver = async (user) => {
  try {
    if (!user || !user.email) {
      console.error('Missing user information for caregiver lookup');
      return null;
    }
    
    // Log the current user info for debugging
    console.log(`Looking for caregiver for user: ${user.name || user.email}`);
    console.log(`User caregiverEmail property: ${user.caregiverEmail || 'Not set'}`);
    
    // If the user doesn't have a caregiverEmail property directly, try to fetch it from user data
    let caregiverEmail = user.caregiverEmail;
    
    if (!caregiverEmail) {
      console.log('No caregiverEmail in user object, fetching from stored user data');
      try {
        const userEmail = user.email.toLowerCase().trim();
        const userDataKey = `userData_${userEmail}`;
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          caregiverEmail = parsedUserData.caregiverEmail;
          console.log(`Found caregiverEmail in stored user data: ${caregiverEmail || 'Not found'}`);
        }
      } catch (error) {
        console.error('Error fetching caregiver email from stored user data:', error);
      }
    }
    
    // If still no caregiver email, check caregiver-patient mappings
    if (!caregiverEmail) {
      console.log('No caregiverEmail found, checking caregiver-patient mappings');
      try {
        const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap');
        if (caregiverPatientsMap) {
          const mappings = JSON.parse(caregiverPatientsMap);
          const userEmail = user.email.toLowerCase().trim();
          caregiverEmail = mappings[userEmail];
          console.log(`Found caregiverEmail in mappings: ${caregiverEmail || 'Not found'}`);
        }
      } catch (error) {
        console.error('Error fetching caregiver email from mappings:', error);
      }
    }
    
    if (!caregiverEmail) {
      console.error('No caregiver email found for this user');
      return null;
    }
    
    // Normalize the email
    caregiverEmail = caregiverEmail.toLowerCase().trim();
    console.log(`Using caregiver email: ${caregiverEmail}`);
    
    // Try to get from AsyncStorage first for faster response
    const caregiverKey = `caregiverInfo_${caregiverEmail}`;
    const storedCaregiver = await AsyncStorage.getItem(caregiverKey);
    
    if (storedCaregiver) {
      const caregiverData = JSON.parse(storedCaregiver);
      console.log(`Using cached caregiver data for: ${caregiverData.name || caregiverEmail}`);
      return caregiverData;
    }
    
    // If not in AsyncStorage, fetch from API
    try {
      console.log(`Fetching caregiver info from API for: ${caregiverEmail}`);
      const response = await axios.get(`${BASE_URL}/api/caregivers/info/${caregiverEmail}`);
      
      if (response.data.success && response.data.caregiver) {
        console.log(`Successfully received caregiver data from API: ${response.data.caregiver.name || caregiverEmail}`);
        // Store for future use
        await AsyncStorage.setItem(caregiverKey, JSON.stringify(response.data.caregiver));
        return response.data.caregiver;
      } else {
        console.error('API returned success: false or missing caregiver data');
      }
    } catch (apiError) {
      console.error('Error fetching caregiver from API:', apiError);
      
      // Try to get caregiver data from other sources
      console.log('Attempting to find caregiver data from other sources');
      
      // Try caregiverData_[email] format
      const caregiverDataKey = `caregiverData_${caregiverEmail}`;
      try {
        const caregiverData = await AsyncStorage.getItem(caregiverDataKey);
        if (caregiverData) {
          const caregiver = JSON.parse(caregiverData);
          console.log(`Found caregiver data in AsyncStorage: ${caregiver.name || caregiverEmail}`);
          
          // Create a simplified caregiver object with required fields
          const simplifiedCaregiver = {
            name: caregiver.name || caregiverEmail,
            email: caregiverEmail
          };
          
          // Store for future use
          await AsyncStorage.setItem(caregiverKey, JSON.stringify(simplifiedCaregiver));
          return simplifiedCaregiver;
        }
      } catch (storageError) {
        console.error('Error fetching caregiver data from AsyncStorage:', storageError);
      }
    }
    
    // If all else fails but we have an email, create a minimal caregiver object
    if (caregiverEmail) {
      console.log('Creating minimal caregiver object with email only');
      const minimalCaregiver = {
        name: 'Caregiver',
        email: caregiverEmail
      };
      
      // Store this minimal info for future use
      await AsyncStorage.setItem(caregiverKey, JSON.stringify(minimalCaregiver));
      return minimalCaregiver;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting connected caregiver:', error);
    return null;
  }
}; 