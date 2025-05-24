import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationService } from '../NavigationRef';

// Create context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  // Load user from storage when the app starts
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        setLoading(true);
        
        // Set flag indicating app is just starting
        await AsyncStorage.setItem('isAppStarting', 'true');
        
        // Check if user or caregiver explicitly logged out
        const userWasLoggedOut = await AsyncStorage.getItem('userLoggedOut');
        const caregiverWasLoggedOut = await AsyncStorage.getItem('caregiverLoggedOut');
        
        if (userWasLoggedOut === 'true' || caregiverWasLoggedOut === 'true') {
          console.log("Auth: Previous logout detected, preventing auto-login");
          setUser(null);
          setLoading(false);
          // Remove the flags to avoid future issues
          await AsyncStorage.removeItem('userLoggedOut');
          await AsyncStorage.removeItem('caregiverLoggedOut');
          return;
        }
        
        // On first app load, prefer to show Welcome screen
        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
        if (!hasLaunchedBefore) {
          console.log("Auth: First app launch ever, starting clean");
          await AsyncStorage.setItem('hasLaunchedBefore', 'true');
          // Don't load any user data on first launch
          setUser(null);
          setLoading(false);
          return;
        }
        
        const userJSON = await AsyncStorage.getItem('user');
        
        if (userJSON) {
          const userData = JSON.parse(userJSON);
          
          // Check if data is valid (has at least an email)
          if (userData && userData.email) {
            console.log("Auth: Found valid user data with email:", userData.email);
            setUser(userData);
          } else {
            console.log("Auth: Found user data but missing email, clearing");
            await AsyncStorage.removeItem('user');
            setUser(null);
          }
        } else {
          console.log("Auth: No user data found in storage");
          setUser(null);
        }
      } catch (error) {
        console.error('Auth: Error loading user data:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);

  // Sign in function
  const signIn = async (userData) => {
    try {
      if (!userData || !userData.email) {
        console.error('Auth: Invalid user data provided to signIn');
        return false;
      }
      
      console.log('Auth: Signing in user:', userData.email);
      
      // Clear any previous logout flags
      await AsyncStorage.removeItem('userLoggedOut');
      await AsyncStorage.removeItem('caregiverLoggedOut');
      
      // Store user data in async storage
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      // Update state
      setUser(userData);
      
      console.log('Auth: User signed in successfully:', userData.email);
      return true;
    } catch (error) {
      console.error('Auth: Error during sign in:', error);
      return false;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log("AuthContext: Starting sign out process");
      
      // Set flags to prevent auto-login on next app start
      setSignedOut(true);
      await AsyncStorage.setItem("userLoggedOut", "true");
      await AsyncStorage.setItem("caregiverLoggedOut", "true");
      
      // Clear all auth-related storage
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("currentUserEmail");
      
      // Reset the auth state
      setUser(null);
      console.log("AuthContext: User state cleared");
      
      // Force navigation to Welcome screen
      setTimeout(() => {
        if (NavigationService.isReady()) {
          console.log("AuthContext: Navigating to Welcome screen");
          NavigationService.reset('Welcome', { fromLogout: true });
        } else {
          console.warn("AuthContext: NavigationService not ready for navigation");
        }
      }, 100); // Small delay to ensure state updates have propagated
    } catch (error) {
      console.error("AuthContext: Error during sign out:", error);
    }
  };

  // Update user profile
  const updateProfile = async (updatedData) => {
    try {
      if (!user) {
        console.error('Auth: Cannot update profile - no user logged in');
        return false;
      }
      
      const updatedUser = { ...user, ...updatedData };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      console.log('Auth: Profile updated successfully for:', user.email);
      return true;
    } catch (error) {
      console.error('Auth: Error updating profile:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 