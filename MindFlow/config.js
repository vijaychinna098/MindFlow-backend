// config.js
import axios from 'axios';
import Constants from 'expo-constants';
import { getPotentialBackendUrls } from './utils/DeviceInfo';

// Production URL from app config or fallback to a fixed production URL
const PRODUCTION_URL = Constants.expoConfig?.extra?.apiUrl || "https://mindflow-backend-1vcl.onrender.com";

// Always use the production URL
export let API_BASE_URL = PRODUCTION_URL;

// Define fallback URLs - only use production URLs
const FALLBACK_URLS = [
  API_BASE_URL, // Try the main URL again
  "https://mindflow-backend-1vcl.onrender.com" // Always try the production URL as fallback
];

// Store the currently active server URL
let activeServerUrl = API_BASE_URL;

// Function to get the active server URL
export const getActiveServerUrl = () => {
  try {
    // First, check if we have a cached active URL
    if (activeServerUrl && activeServerUrl !== "") {
      return activeServerUrl;
    }
    
    // If no cached URL, try the configured API URL
    if (API_BASE_URL && API_BASE_URL !== "") {
      return API_BASE_URL;
    }
    
    // If nothing else works, return the production URL
    return PRODUCTION_URL;
  } catch (error) {
    console.error("Error getting active server URL:", error.message);
    // If there's an error, return the production URL
    return PRODUCTION_URL;
  }
};

// Function to initialize and test backend connections
export const initializeBackendConnection = async () => {
  console.log(`Using production API: ${API_BASE_URL}`);
  
  // Try to ping the production API to ensure it's available
  try {
    // Define all the possible ping endpoints to try
    const pingEndpoints = [
      '/ping', 
      '/api/ping',
      '/api/users/ping',
      '/api/health',
      '/health',
      '/api',
      '/api/status'
    ];
    
    // Try each endpoint
    for (const endpoint of pingEndpoints) {
      try {
        console.log(`Trying ping endpoint: ${API_BASE_URL}${endpoint}`);
        const response = await axios.get(`${API_BASE_URL}${endpoint}`, { 
          timeout: 5000, 
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.status === 200) {
          console.log(`✅ Successfully connected to backend at: ${API_BASE_URL}`);
          return API_BASE_URL;
        }
      } catch (endpointError) {
        console.log(`Endpoint ${endpoint} failed: ${endpointError.message}`);
        // Continue to next endpoint
      }
    }
    
    // If all direct verification attempts failed, try a fallback URL
    try {
      const fallbackUrl = "https://mindflow-backend-1vcl.onrender.com";
      console.log(`Trying fallback server URL: ${fallbackUrl}`);
      
      // Try each endpoint with the fallback URL
      for (const endpoint of pingEndpoints) {
        try {
          console.log(`Trying ping endpoint: ${fallbackUrl}${endpoint}`);
          const response = await axios.get(`${fallbackUrl}${endpoint}`, { 
            timeout: 5000,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.status === 200) {
            console.log(`✅ Successfully connected to fallback backend at: ${fallbackUrl}`);
            activeServerUrl = fallbackUrl;
            API_BASE_URL = fallbackUrl;
            return fallbackUrl;
          }
        } catch (fallbackEndpointError) {
          console.log(`Fallback endpoint ${endpoint} failed: ${fallbackEndpointError.message}`);
        }
      }
    } catch (fallbackError) {
      console.log(`Failed to connect to fallback: ${fallbackError.message}`);
    }
  } catch (error) {
    console.log(`Failed to connect to ${API_BASE_URL}: ${error.message}`);
  }
  
  console.log(`⚠️ Could not connect to backend. Using default: ${API_BASE_URL}`);
  return API_BASE_URL;
};

// Error handling utilities
export const handleApiError = (error, defaultMessage = "An error occurred") => {
  console.log("API Error Details:", error.message);
  
  if (error.response) {
    // The server responded with an error status
    console.log(`Server responded with error ${error.response.status}:`, error.response.data);
    
    // Special handling for patient-related errors
    if (error.response.status === 404) {
      if (error.response.data?.message?.includes('Patient')) {
        return {
          status: 404,
          message: "This patient account doesn't exist or has been deleted.",
          isServerError: true,
          isPatientError: true
        };
      } else if (error.response.data?.message?.includes('Caregiver')) {
        return {
          status: 404,
          message: "Caregiver account not found. Please log in again.",
          isServerError: true
        };
      }
    }
    
    // Special handling for account deletion errors
    if (error.config?.url?.includes('/deleteAccount')) {
      if (error.response.status === 404) {
        return {
          status: 404,
          message: "Account not found. It may have been already deleted or doesn't exist.",
          isServerError: true,
          isAccountDeletionError: true
        };
      } else if (error.response.status === 500) {
        return {
          status: 500,
          message: "Server error during account deletion. Try again or contact support.",
          isServerError: true,
          isAccountDeletionError: true
        };
      }
    }
    
    return {
      status: error.response.status,
      message: error.response.data?.message || defaultMessage,
      isServerError: true
    };
  } else if (error.request) {
    // The request was made but no response was received
    console.log("Network Error - No response received:", error.request);
    
    // Special handling for account deletion with network errors
    if (error.config?.url?.includes('/deleteAccount')) {
      return {
        status: 0,
        message: "Network error during account deletion. Your account may still be active.",
        isNetworkError: true,
        isAccountDeletionError: true
      };
    }
    
    return {
      status: 0,
      message: "Network error: Could not connect to server. Please check your internet connection.",
      isNetworkError: true
    };
  } else {
    // Something happened in setting up the request
    console.log("Request Setup Error:", error.message);
    return {
      status: -1,
      message: error.message || defaultMessage,
      isSetupError: true
    };
  }
};

// Function to safely make API calls with proper error handling
export const safeApiCall = async (apiFunction, fallbackValue = null, errorMessage = "API error") => {
  try {
    return await apiFunction();
  } catch (error) {
    console.log("Error suppressed:", errorMessage, error.message || error);
    return fallbackValue;
  }
};

// Check server connectivity
export const checkServerConnectivity = async () => {
  try {
    // Try multiple ping endpoints for better reliability
    const pingEndpoints = [
      '/api/ping',         // Try root ping endpoint
      '/api/users/ping',   // Try user-specific ping
      '/api/users',        // Try user root endpoint
      '/api'               // Try API root
    ];
    
    console.log("Checking server connectivity...");
    let axios;
    try {
      axios = require('axios');
    } catch (error) {
      console.error("Axios not available, cannot check connectivity");
      return { connected: false, message: "Axios not available" };
    }
    
    // Get the current server URL
    const serverUrl = getActiveServerUrl();
    console.log(`Using server URL: ${serverUrl}`);
    
    // Try each endpoint until one succeeds
    for (const endpoint of pingEndpoints) {
      try {
        console.log(`Attempting to reach server at: ${serverUrl}${endpoint}`);
        const response = await axios.get(`${serverUrl}${endpoint}`, { 
          timeout: 5000,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.status === 200) {
          console.log(`Server connected via ${endpoint}`);
          // Store the successful URL as the active URL
          activeServerUrl = serverUrl;
          return { 
            connected: true, 
            message: "Server connection established",
            endpoint: endpoint
          };
        }
      } catch (endpointError) {
        console.log(`Endpoint ${endpoint} failed: ${endpointError.message}`);
        // Continue to next endpoint
      }
    }
    
    // If primary server fails, try fallback URLs
    for (const fallbackUrl of FALLBACK_URLS) {
      // Skip the URL we already tried
      if (fallbackUrl === serverUrl) continue;
      
      console.log(`Trying fallback server URL: ${fallbackUrl}`);
      
      // Try each endpoint with the fallback URL
      for (const endpoint of pingEndpoints) {
        try {
          console.log(`Attempting to reach fallback server at: ${fallbackUrl}${endpoint}`);
          const response = await axios.get(`${fallbackUrl}${endpoint}`, { 
            timeout: 5000,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.status === 200) {
            console.log(`Fallback server connected via ${endpoint}`);
            // Update the active URL to the successful fallback
            activeServerUrl = fallbackUrl;
            API_BASE_URL = fallbackUrl;
            return { 
              connected: true, 
              message: "Connected to fallback server",
              endpoint: endpoint,
              usingFallback: true,
              fallbackUrl: fallbackUrl
            };
          }
        } catch (fallbackEndpointError) {
          console.log(`Fallback endpoint ${endpoint} failed: ${fallbackEndpointError.message}`);
          // Continue to next endpoint
        }
      }
    }
    
    // All connection attempts failed
    console.log("All server connection attempts failed");
    return { 
      connected: false, 
      message: "Could not connect to any server",
      serverUrl: serverUrl,
      fallbacksAttempted: FALLBACK_URLS.filter(url => url !== serverUrl)
    };
  } catch (error) {
    console.error("Error checking server connectivity:", error.message);
    return { connected: false, message: error.message };
  }
};