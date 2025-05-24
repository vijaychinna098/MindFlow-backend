import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Helper utility to get the development server IP dynamically
 */
export const getDevServerIP = async () => {
  // In production, always use the configured API URL
  if (!__DEV__) {
    return null;
  }
  
  try {
    // Get network info
    const netInfo = await NetInfo.fetch();
    
    if (Platform.OS === 'ios') {
      // iOS simulator typically uses localhost
      return 'localhost';
    } else if (Platform.OS === 'android') {
      // For Android emulator
      if (netInfo.isConnected) {
        // Android emulator: 10.0.2.2 is the special IP that maps to the host machine's localhost
        return '10.0.2.2';
      }
    }
    
    // Default fallback
    return 'localhost';
  } catch (error) {
    console.error('Error getting device info:', error);
    return 'localhost';
  }
};

/**
 * Get a list of potential backend URLs to try
 */
export const getPotentialBackendUrls = async (port = 5000) => {
  const devServerIp = await getDevServerIP();
  
  const urls = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ];
  
  if (devServerIp && devServerIp !== 'localhost') {
    urls.unshift(`http://${devServerIp}:${port}`);
  }
  
  return urls;
}; 