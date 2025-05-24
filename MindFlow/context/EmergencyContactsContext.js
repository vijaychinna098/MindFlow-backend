import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const EmergencyContactsContext = createContext();

// Provider component
export const EmergencyContactsProvider = ({ children }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load contacts from storage when component mounts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);
        const storedContacts = await AsyncStorage.getItem('emergencyContacts');
        if (storedContacts) {
          setContacts(JSON.parse(storedContacts));
        }
      } catch (error) {
        console.error('Error loading emergency contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, []);

  // Save contacts to storage whenever they change
  useEffect(() => {
    const saveContacts = async () => {
      try {
        await AsyncStorage.setItem('emergencyContacts', JSON.stringify(contacts));
      } catch (error) {
        console.error('Error saving emergency contacts:', error);
      }
    };

    if (!loading) {
      saveContacts();
    }
  }, [contacts, loading]);

  // Add a new contact
  const addContact = (contact) => {
    setContacts([...contacts, { ...contact, id: Date.now().toString() }]);
  };

  // Update an existing contact
  const updateContact = (id, updatedContact) => {
    setContacts(
      contacts.map((contact) =>
        contact.id === id ? { ...updatedContact, id } : contact
      )
    );
  };

  // Delete a contact
  const deleteContact = (id) => {
    setContacts(contacts.filter((contact) => contact.id !== id));
  };

  return (
    <EmergencyContactsContext.Provider
      value={{
        contacts,
        loading,
        addContact,
        updateContact,
        deleteContact,
        setContacts,
      }}
    >
      {children}
    </EmergencyContactsContext.Provider>
  );
};

// Custom hook to use the emergency contacts context
export const useEmergencyContacts = () => {
  const context = useContext(EmergencyContactsContext);
  if (!context) {
    throw new Error('useEmergencyContacts must be used within an EmergencyContactsProvider');
  }
  return context;
}; 