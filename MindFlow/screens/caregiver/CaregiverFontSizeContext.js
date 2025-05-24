import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FontSizeContext = createContext();

export const FontSizeProvider = ({ children }) => {
  const [fontSize, setFontSize] = useState(16);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved font size from AsyncStorage when component mounts
  useEffect(() => {
    const loadSavedFontSize = async () => {
      try {
        const savedFontSize = await AsyncStorage.getItem('caregiverFontSize');
        if (savedFontSize !== null) {
          setFontSize(parseFloat(savedFontSize));
        }
      } catch (error) {
        console.error('Error loading font size from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedFontSize();
  }, []);

  // Create a wrapped version of setFontSize that also saves to AsyncStorage
  const setAndSaveFontSize = (newSize) => {
    setFontSize(newSize);
    // Save to AsyncStorage
    AsyncStorage.setItem('caregiverFontSize', newSize.toString())
      .catch(error => console.error('Error saving font size to storage:', error));
  };

  return (
    <FontSizeContext.Provider 
      value={{ 
        fontSize, 
        setFontSize: setAndSaveFontSize,
        isLoading
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};