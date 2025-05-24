import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCaregiver } from '../CaregiverContext';
import { useUser } from '../UserContext';

// Create memories context
export const MemoriesContext = createContext();

// Provider component
export const MemoriesProvider = ({ children }) => {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activePatient, caregiver } = useCaregiver() || {};
  const { currentUser } = useUser() || {};
  
  // Determine if in caregiver mode
  const isCaregiverMode = !!caregiver;
  // Get the appropriate email for storage key
  const userEmail = isCaregiverMode 
    ? caregiver?.email?.toLowerCase().trim() 
    : currentUser?.email?.toLowerCase().trim();
  
  // Get the active patient's email if in caregiver mode
  const patientEmail = isCaregiverMode && activePatient 
    ? activePatient.email.toLowerCase().trim() 
    : null;

  // Load memories from storage when component mounts or when active patient changes
  useEffect(() => {
    const loadMemories = async () => {
      try {
        setLoading(true);
        
        // Determine the storage key based on mode
        let storageKey;
        
        if (isCaregiverMode && patientEmail) {
          // In caregiver mode with active patient, load patient-specific memories
          storageKey = `memories_${patientEmail}`;
          console.log(`Loading memories for patient: ${patientEmail}`);
        } else if (userEmail) {
          // In user mode or no active patient, load user's own memories
          storageKey = `memories_${userEmail}`;
          console.log(`Loading memories for user: ${userEmail}`);
        } else {
          // No user or caregiver logged in
          console.log('No user or caregiver logged in, cannot load memories');
          setMemories([]);
          setLoading(false);
          return;
        }
        
        const storedMemories = await AsyncStorage.getItem(storageKey);
        if (storedMemories) {
          const parsedMemories = JSON.parse(storedMemories);
          console.log(`Loaded ${parsedMemories.length} memories from storage`);
          
          // Filter memories for this specific user/patient if needed
          const filteredMemories = isCaregiverMode && patientEmail
            ? parsedMemories.filter(memory => 
                memory.forPatient && 
                memory.forPatient.toLowerCase().trim() === patientEmail
              )
            : parsedMemories;
            
          setMemories(filteredMemories);
        } else {
          console.log(`No memories found in storage for ${storageKey}`);
          setMemories([]);
        }
      } catch (error) {
        console.error('Error loading memories:', error);
        setMemories([]);
      } finally {
        setLoading(false);
      }
    };

    loadMemories();
  }, [isCaregiverMode, userEmail, patientEmail]);

  // Save memories to storage whenever they change
  useEffect(() => {
    const saveMemories = async () => {
      try {
        // Determine the storage key based on mode
        let storageKey;
        
        if (isCaregiverMode && patientEmail) {
          // In caregiver mode with active patient, save to patient's storage
          storageKey = `memories_${patientEmail}`;
          
          // Also set up mapping for the patient to find their caregiver
          if (caregiver?.email) {
            await AsyncStorage.setItem(`memory_mapping_${patientEmail}`, caregiver.email);
          }
        } else if (userEmail) {
          // In user mode or no active patient, save to user's own storage
          storageKey = `memories_${userEmail}`;
        } else {
          // No user or caregiver logged in
          console.error('No user or caregiver logged in, cannot save memories');
          return;
        }
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(memories));
        console.log(`Saved ${memories.length} memories to ${storageKey}`);
      } catch (error) {
        console.error('Error saving memories:', error);
      }
    };

    if (!loading) {
      saveMemories();
    }
  }, [memories, loading, isCaregiverMode, userEmail, patientEmail, caregiver]);

  // Add a new memory
  const addMemory = useCallback((memory) => {
    try {
      const now = new Date();
      const memoryToAdd = {
        ...memory,
        id: memory.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: memory.createdAt || now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      // Add caregiver attribution if in caregiver mode
      if (isCaregiverMode && patientEmail) {
        console.log(`Adding caregiver attribution to memory for patient: ${patientEmail}`);
        memoryToAdd.forPatient = patientEmail;
        memoryToAdd.addedByCaregiver = true;
        memoryToAdd.caregiverEmail = caregiver?.email || '';
      }
      
      console.log('Adding memory:', memoryToAdd);
      setMemories(prev => [...(Array.isArray(prev) ? prev : []), memoryToAdd]);
      return true;
    } catch (error) {
      console.error('Error adding memory:', error);
      return false;
    }
  }, [isCaregiverMode, patientEmail, caregiver]);

  // Update an existing memory
  const updateMemory = useCallback((id, updatedMemory) => {
    try {
      const now = new Date();
      
      setMemories(prev => {
        if (!Array.isArray(prev)) return [];
        
        return prev.map(memory => {
          if (memory.id === id) {
            // Preserve attribution data
            const updated = { 
              ...memory, 
              ...updatedMemory, 
              id,
              updatedAt: now.toISOString()
            };
            
            // Ensure patient attribution is preserved
            if (isCaregiverMode && patientEmail) {
              updated.forPatient = patientEmail;
              updated.addedByCaregiver = true;
              updated.caregiverEmail = caregiver?.email || '';
            }
            
            return updated;
          }
          return memory;
        });
      });
      
      return true;
    } catch (error) {
      console.error('Error updating memory:', error);
      return false;
    }
  }, [isCaregiverMode, patientEmail, caregiver]);

  // Delete a memory
  const deleteMemory = useCallback((id) => {
    try {
      setMemories(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.filter(memory => memory.id !== id);
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }, []);

  return (
    <MemoriesContext.Provider
      value={{
        memories,
        loading,
        addMemory,
        updateMemory,
        deleteMemory,
        setMemories
      }}
    >
      {children}
    </MemoriesContext.Provider>
  );
};

// Custom hook to use the memories context
export const useMemories = () => {
  const context = useContext(MemoriesContext);
  if (!context) {
    throw new Error('useMemories must be used within a MemoriesProvider');
  }
  return context;
}; 