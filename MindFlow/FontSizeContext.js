import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FontSizeContext = createContext();

export const FontSizeProvider = ({ children }) => {
  const [fontSize, setFontSize] = useState(18); // Default font size

  // Load saved font size on component mount
  useEffect(() => {
    const loadFontSize = async () => {
      try {
        const savedFontSize = await AsyncStorage.getItem('fontSize');
        if (savedFontSize !== null) {
          setFontSize(Number(savedFontSize));
        }
      } catch (error) {
        console.error('Error loading font size:', error);
      }
    };

    loadFontSize();
  }, []);

  // Save font size when it changes
  const changeFontSize = async (newSize) => {
    try {
      setFontSize(newSize);
      await AsyncStorage.setItem('fontSize', newSize.toString());
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  return (
    <FontSizeContext.Provider 
      value={{ 
        fontSize, 
        setFontSize: changeFontSize, 
        increaseFontSize: () => changeFontSize(fontSize + 1),
        decreaseFontSize: () => changeFontSize(fontSize - 1),
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  console.log('FontSizeContext value:', context); // Debugging log
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

export default FontSizeContext;