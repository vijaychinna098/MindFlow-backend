import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Create context
const ConnectionContext = createContext();

// Provider component
export const ConnectionProvider = ({ children }) => {
  const [serverReachable, setServerReachable] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [checking, setChecking] = useState(false);

  // Monitor server availability periodically
  useEffect(() => {
    // Initial check
    checkServerReachable();
    
    // Check server availability every 30 seconds
    const interval = setInterval(() => {
      if (!isOfflineMode) {
        // Only check automatically if not in explicit offline mode
        checkServerReachable();
      }
    }, 30000);
    
    // Cleanup interval
    return () => clearInterval(interval);
  }, [isOfflineMode]);

  // Check if server is reachable
  const checkServerReachable = async () => {
    setChecking(true);
    try {
      // Set a timeout of 3 seconds
      const response = await axios.get(`${API_BASE_URL}/ping`, { timeout: 3000 });
      setServerReachable(true);
      
      // If we were in offline mode due to connection issue and server is now available,
      // exit offline mode
      if (isOfflineMode) {
        setIsOfflineMode(false);
      }
      
      console.log('Server connection check: ONLINE');
      setChecking(false);
      return true;
    } catch (error) {
      console.log('Server connection check: OFFLINE', error.message);
      setServerReachable(false);
      setChecking(false);
      return false;
    }
  };

  // Force offline mode (useful for testing or when user prefers it)
  const goOffline = () => {
    setIsOfflineMode(true);
  };

  // Force online mode (will check connection first)
  const goOnline = async () => {
    const serverAvailable = await checkServerReachable();
    if (serverAvailable) {
      setIsOfflineMode(false);
      return true;
    }
    return false;
  };

  return (
    <ConnectionContext.Provider
      value={{
        serverReachable,
        isOfflineMode,
        checking,
        checkServerReachable,
        goOffline,
        goOnline
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

// Custom hook to use the connection context
export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}; 