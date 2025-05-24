import { createRef } from 'react';
import { NavigationRef } from '../NavigationRef';

// Create a reference to the navigation object
const navigationRef = createRef();

// Check if navigation is ready
const isReady = () => {
  return navigationRef.current !== null;
};

// Navigate to a specific route
const navigate = (name, params) => {
  if (isReady()) {
    navigationRef.current.navigate(name, params);
  } else {
    console.warn('NavigationService: Cannot navigate, navigation is not ready');
  }
};

// Reset navigation and go to a specific route
const reset = (name, params = {}) => {
  if (isReady()) {
    navigationRef.current.reset({
      index: 0,
      routes: [{ name, params }],
    });
  } else {
    console.warn('NavigationService: Cannot reset, navigation is not ready');
  }
};

// Specific navigation functions
const navigateToWelcome = () => {
  reset('Welcome');
};

const navigateToUserHome = () => {
  reset('UserStack');
};

const navigateToCaregiverHome = () => {
  reset('CaregiverStack');
};

export default {
  navigationRef,
  isReady,
  navigate,
  reset,
  navigateToWelcome,
  navigateToUserHome,
  navigateToCaregiverHome,
}; 