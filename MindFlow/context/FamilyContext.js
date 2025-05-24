import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
export const FamilyContext = createContext();

// Provider component
export const FamilyProvider = ({ children }) => {
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load family members from storage when component mounts
  useEffect(() => {
    const loadFamilyMembers = async () => {
      try {
        setLoading(true);
        const storedFamilyMembers = await AsyncStorage.getItem('familyMembers');
        if (storedFamilyMembers) {
          setFamilyMembers(JSON.parse(storedFamilyMembers));
        }
      } catch (error) {
        console.error('Error loading family members:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFamilyMembers();
  }, []);

  // Save family members to storage whenever they change
  useEffect(() => {
    const saveFamilyMembers = async () => {
      try {
        await AsyncStorage.setItem('familyMembers', JSON.stringify(familyMembers));
      } catch (error) {
        console.error('Error saving family members:', error);
      }
    };

    if (!loading) {
      saveFamilyMembers();
    }
  }, [familyMembers, loading]);

  // Add a new family member
  const addFamilyMember = (member) => {
    setFamilyMembers([...familyMembers, { ...member, id: Date.now().toString() }]);
  };

  // Update an existing family member
  const updateFamilyMember = (id, updatedMember) => {
    setFamilyMembers(
      familyMembers.map((member) =>
        member.id === id ? { ...updatedMember, id } : member
      )
    );
  };

  // Delete a family member
  const deleteFamilyMember = (id) => {
    setFamilyMembers(familyMembers.filter((member) => member.id !== id));
  };

  return (
    <FamilyContext.Provider
      value={{
        familyMembers,
        loading,
        addFamilyMember,
        updateFamilyMember,
        deleteFamilyMember,
        setFamilyMembers
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

// Custom hook to use the family context
export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}; 