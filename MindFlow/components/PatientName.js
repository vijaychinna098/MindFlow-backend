import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useUser } from '../UserContext';

/**
 * Component that always shows the correct patient name
 * 
 * @param {Object} props - Component props
 * @param {string} props.email - The patient email to get name for
 * @param {string} props.style - Additional style for the Text component
 * @param {boolean} props.useActive - Whether to use active patient (default: false)
 * @param {function} props.onNameLoaded - Callback when name is loaded
 * @param {string} props.defaultName - Default name to show while loading
 */
const PatientName = ({ 
  email, 
  style,
  useActive = false,
  onNameLoaded,
  defaultName = 'Patient',
  ...otherProps 
}) => {
  const [name, setName] = useState(defaultName);
  const [isLoading, setIsLoading] = useState(true);
  const { getExactPatientName, getActivePatientExactName } = useUser();

  // Memoize email for stability in dependency array
  const memoizedEmail = useMemo(() => email, [email]);
  
  // Create stable callback for name loading
  const loadName = useCallback(async () => {
    try {
      let patientName;
      
      if (useActive) {
        // Get active patient name
        patientName = await getActivePatientExactName();
      } else if (memoizedEmail) {
        // Get specific patient name
        patientName = await getExactPatientName(memoizedEmail);
      }
      
      if (patientName) {
        setName(patientName);
        if (onNameLoaded) {
          onNameLoaded(patientName);
        }
      } else {
        // Fallback to default
        setName(defaultName);
      }
    } catch (error) {
      console.log(`Error loading patient name: ${error.message}`);
      setName(defaultName);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedEmail, useActive, getExactPatientName, getActivePatientExactName, defaultName, onNameLoaded]);

  useEffect(() => {
    // Prevent multiple simultaneous fetches
    let isMounted = true;
    setIsLoading(true);
    
    // Add a small delay to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        loadName();
      }
    }, 100);
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [loadName]);

  if (isLoading) {
    return <ActivityIndicator size="small" color="#007AFF" />;
  }

  return (
    <Text style={[styles.nameText, style]} {...otherProps}>
      {name}
    </Text>
  );
};

const styles = StyleSheet.create({
  nameText: {
    fontSize: 16,
    fontWeight: '500',
  }
});

// Memoize the entire component to prevent unnecessary re-renders
export default React.memo(PatientName); 