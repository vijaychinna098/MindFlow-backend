import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../UserContext';
import { BASE_URL } from '../../config';
import axios from 'axios';

// Initial demo contacts
const initialContacts = [
  {
    id: '1',
    name: 'Mom',
    relationship: 'Mother',
    photo: 'https://via.placeholder.com/150/FFB6C1/000000?text=Mom',
    emergency: false,
    note: 'You went to Goa with her in 2019.',
    phone: '+15551234567',
  },
  {
    id: '2',
    name: 'Ramesh',
    relationship: 'Son',
    photo: 'https://via.placeholder.com/150/87CEFA/000000?text=Son',
    emergency: false,
    note: 'Your beloved son.',
    phone: '+15557654321',
  },
  {
    id: '3',
    name: 'Dr. Smith',
    relationship: 'Doctor',
    photo: 'https://via.placeholder.com/150/FF6347/000000?text=Doctor',
    emergency: true,
    note: 'Primary Caregiver',
    phone: '+15559876543',
    email: 'dr.smith@example.com', // Sample caregiver email
    isCaregiver: true, // Mark this contact as the caregiver
  },
];

const CaregiverScreen = () => {
  const { currentUser, saveUserData } = useUser();
  const [language, setLanguage] = useState('en'); // default language for voice assistance
  const [contacts, setContacts] = useState(initialContacts);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '', // Added email field
    relationship: '',
    note: '',
    photo: '',
    emergency: false,
    isCaregiver: false, // Added field to mark as caregiver
  });
  const [caregiver, setCaregiver] = useState(null);
  
  // Load saved contacts and caregiver info
  useEffect(() => {
    const loadContacts = async () => {
      try {
        if (currentUser && currentUser.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          const contactsKey = `contacts_${userEmail}`;
          const storedContacts = await AsyncStorage.getItem(contactsKey);
          
          if (storedContacts) {
            setContacts(JSON.parse(storedContacts));
          }
          
          // Check if the user already has a caregiver
          if (currentUser.caregiverEmail && currentUser.caregiverName) {
            console.log(`Found caregiver in user data: ${currentUser.caregiverName} <${currentUser.caregiverEmail}>`);
            setCaregiver({
              name: currentUser.caregiverName,
              email: currentUser.caregiverEmail
            });
          } else {
            // Look for caregiver in contacts
            const savedContacts = storedContacts ? JSON.parse(storedContacts) : contacts;
            const caregiverContact = savedContacts.find(contact => contact.isCaregiver);
            
            if (caregiverContact && caregiverContact.email) {
              console.log(`Found caregiver in contacts: ${caregiverContact.name} <${caregiverContact.email}>`);
              setCaregiver({
                name: caregiverContact.name,
                email: caregiverContact.email
              });
              
              // Update the user's data with the caregiver info
              updateUserCaregiverInfo(caregiverContact.name, caregiverContact.email);
            }
          }
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    };
    
    loadContacts();
  }, [currentUser]);
  
  // Update the user's caregiver information in AsyncStorage and user context
  const updateUserCaregiverInfo = async (caregiverName, caregiverEmail) => {
    try {
      if (!currentUser || !caregiverEmail) return;
      
      console.log(`Updating user's caregiver info: ${caregiverName} <${caregiverEmail}>`);
      
      // Update the user object with caregiver info
      const updatedUser = {
        ...currentUser,
        caregiverEmail: caregiverEmail.toLowerCase().trim(),
        caregiverName: caregiverName
      };
      
      // Save to AsyncStorage via UserContext
      await saveUserData(updatedUser);
      
      // Update caregiver-patient mapping
      await updateCaregiverPatientMapping(caregiverEmail, currentUser.email);
      
      console.log('Caregiver information updated successfully');
    } catch (error) {
      console.error('Error updating caregiver information:', error);
    }
  };
  
  // Update the caregiver-patient mapping in AsyncStorage
  const updateCaregiverPatientMapping = async (caregiverEmail, patientEmail) => {
    try {
      if (!caregiverEmail || !patientEmail) return;
      
      const caregiverEmailNormalized = caregiverEmail.toLowerCase().trim();
      const patientEmailNormalized = patientEmail.toLowerCase().trim();
      
      console.log(`Updating caregiver-patient mapping: ${caregiverEmailNormalized} -> ${patientEmailNormalized}`);
      
      // Get existing mappings
      const mappingsKey = 'caregiverPatientsMap';
      const existingMappingsJSON = await AsyncStorage.getItem(mappingsKey);
      const mappings = existingMappingsJSON ? JSON.parse(existingMappingsJSON) : {};
      
      // Update the mapping
      mappings[patientEmailNormalized] = caregiverEmailNormalized;
      
      // Save the updated mappings
      await AsyncStorage.setItem(mappingsKey, JSON.stringify(mappings));
      
      console.log('Caregiver-patient mapping updated successfully');
    } catch (error) {
      console.error('Error updating caregiver-patient mapping:', error);
    }
  };

  // Function to speak contact info when pressed.
  const handleContactPress = (contact) => {
    const message = `You are calling your ${contact.relationship}, ${contact.name}. ${contact.note}`;
    Speech.speak(message, { language, rate: 0.9 });
    Alert.alert("Voice Assistance", message);
  };

  // Delete a contact.
  const handleDeleteContact = (id) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => setContacts((prev) => prev.filter(c => c.id !== id)) },
      ]
    );
  };

  // Add new contact.
  const handleAddContact = () => {
    const { name, phone, relationship } = newContact;
    if (!name || !phone || !relationship) {
      Alert.alert('Missing Fields', 'Please fill in name, phone and relationship');
      return;
    }
    const newId = Date.now().toString();
    const contactToAdd = { ...newContact, id: newId };
    
    const updatedContacts = [...contacts, contactToAdd];
    setContacts(updatedContacts);
    
    // Save contacts to AsyncStorage
    if (currentUser && currentUser.email) {
      const userEmail = currentUser.email.toLowerCase().trim();
      const contactsKey = `contacts_${userEmail}`;
      AsyncStorage.setItem(contactsKey, JSON.stringify(updatedContacts));
    }
    
    // If this contact is marked as caregiver, update user's caregiver info
    if (newContact.isCaregiver && newContact.email) {
      updateUserCaregiverInfo(newContact.name, newContact.email);
      setCaregiver({
        name: newContact.name,
        email: newContact.email
      });
    }
    
    // Reset form
    setNewContact({
      name: '',
      phone: '',
      email: '',
      relationship: '',
      note: '',
      photo: '',
      emergency: false,
      isCaregiver: false,
    });
    setIsAdding(false);
  };
  
  // Set a contact as caregiver
  const setContactAsCaregiver = (contact) => {
    if (!contact.email) {
      Alert.alert('Email Missing', 'Please add an email for this contact to set them as caregiver');
      return;
    }
    
    Alert.alert(
      'Set as Caregiver',
      `Are you sure you want to set ${contact.name} as your caregiver? They will receive alerts if you're outside your safe area.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            // Update the contacts list to mark this contact as caregiver
            const updatedContacts = contacts.map(c => ({
              ...c,
              isCaregiver: c.id === contact.id
            }));
            
            setContacts(updatedContacts);
            
            // Save to AsyncStorage
            if (currentUser && currentUser.email) {
              const userEmail = currentUser.email.toLowerCase().trim();
              const contactsKey = `contacts_${userEmail}`;
              await AsyncStorage.setItem(contactsKey, JSON.stringify(updatedContacts));
            }
            
            // Update user's caregiver info
            updateUserCaregiverInfo(contact.name, contact.email);
            setCaregiver({
              name: contact.name,
              email: contact.email
            });
            
            Alert.alert('Caregiver Set', `${contact.name} has been set as your caregiver.`);
          }
        }
      ]
    );
  };

  // Render each contact card.
  const renderContact = ({ item }) => (
    <View style={[styles.contactCard, item.emergency && styles.emergencyCard, item.isCaregiver && styles.caregiverCard]}>
      <TouchableOpacity onPress={() => handleContactPress(item)}>
        <Image source={{ uri: item.photo || 'https://via.placeholder.com/150' }} style={styles.contactImage} />
        {item.isCaregiver && (
          <View style={styles.caregiverBadge}>
            <Text style={styles.caregiverBadgeText}>Caregiver</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.contactName}>{item.name}</Text>
      <Text style={styles.contactRelation}>{item.relationship}</Text>
      {item.email && <Text style={styles.contactEmail}>{item.email}</Text>}
      {item.note ? <Text style={styles.contactNote}>{item.note}</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Call', `Calling ${item.name}...`)}>
          <Ionicons name="call" size={20} color="#FFF" />
        </TouchableOpacity>
        {!item.isCaregiver && item.email && (
          <TouchableOpacity 
            style={[styles.actionButton, {backgroundColor: '#005BBB'}]} 
            onPress={() => setContactAsCaregiver(item)}
          >
            <Ionicons name="shield-checkmark" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteContact(item.id)}>
          <Ionicons name="trash" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Family & Caregiver Contacts</Text>
      
      {/* Current Caregiver Info */}
      {caregiver ? (
        <View style={styles.caregiverInfoCard}>
          <Ionicons name="shield-checkmark" size={24} color="#005BBB" />
          <View style={styles.caregiverInfoContent}>
            <Text style={styles.caregiverInfoTitle}>Current Caregiver</Text>
            <Text style={styles.caregiverInfoName}>{caregiver.name}</Text>
            <Text style={styles.caregiverInfoEmail}>{caregiver.email}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.noCaregiverCard}>
          <Ionicons name="alert-circle-outline" size={24} color="#FF6347" />
          <Text style={styles.noCaregiverText}>
            No caregiver set. Please add a contact with email and set them as your caregiver.
          </Text>
        </View>
      )}
      
      {/* Language Selection */}
      <View style={styles.languageContainer}>
        <Text style={styles.languageLabel}>Language:</Text>
        <Picker
          selectedValue={language}
          style={styles.picker}
          onValueChange={(itemValue) => setLanguage(itemValue)}
        >
          <Picker.Item label="English" value="en" />
          <Picker.Item label="Spanish" value="es" />
          <Picker.Item label="Hindi" value="hi" />
          <Picker.Item label="Telugu" value="te" />
        </Picker>
      </View>
      
      {/* Contacts Grid */}
      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.contactsGrid}
      />

      {/* Add New Contact Form */}
      {isAdding ? (
        <View style={styles.addContactContainer}>
          <Text style={styles.modalTitle}>Add New Contact</Text>
          <TextInput
            placeholder="Name"
            style={styles.input}
            value={newContact.name}
            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
          />
          <TextInput
            placeholder="Phone"
            style={styles.input}
            keyboardType="phone-pad"
            value={newContact.phone}
            onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
          />
          <TextInput
            placeholder="Email (Required for Caregiver)"
            style={styles.input}
            keyboardType="email-address"
            value={newContact.email}
            onChangeText={(text) => setNewContact({ ...newContact, email: text })}
          />
          <TextInput
            placeholder="Relationship (e.g., Son, Caregiver)"
            style={styles.input}
            value={newContact.relationship}
            onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
          />
          <TextInput
            placeholder="Note (Optional)"
            style={styles.input}
            value={newContact.note}
            onChangeText={(text) => setNewContact({ ...newContact, note: text })}
          />
          
          {/* Caregiver Checkbox */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[styles.checkbox, newContact.isCaregiver && styles.checkboxChecked]}
              onPress={() => setNewContact({ ...newContact, isCaregiver: !newContact.isCaregiver })}
            >
              {newContact.isCaregiver && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Set as Caregiver (will receive location alerts)</Text>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.modalButton} onPress={() => setIsAdding(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={handleAddContact}>
              <Text style={styles.modalButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)}>
          <Ionicons name="add-circle" size={40} color="#005BBB" />
          <Text style={styles.addButtonText}>Add New Contact</Text>
        </TouchableOpacity>
      )}

      {/* Option for Caregiver: A button to share patient's location */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => Alert.alert("Location Sharing", "This feature is coming soon!")}
      >
        <Text style={styles.locationButtonText}>Share Patient Location</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F0F4F8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#005BBB',
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  languageLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  picker: {
    flex: 1,
    height: 40,
  },
  contactsGrid: {
    paddingBottom: 80,
  },
  contactCard: {
    flex: 1,
    margin: 10,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  emergencyCard: {
    borderWidth: 2,
    borderColor: '#FF6347',
  },
  caregiverCard: {
    borderWidth: 2,
    borderColor: '#005BBB',
    backgroundColor: '#F0F8FF',
  },
  contactImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  contactName: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
    textAlign: 'center',
  },
  contactRelation: {
    color: '#777',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  contactNote: {
    fontStyle: 'italic',
    color: '#555',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionButton: {
    backgroundColor: '#FF6347',
    padding: 8,
    borderRadius: 20,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  addButtonText: {
    color: '#005BBB',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  addContactContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    backgroundColor: '#005BBB',
    padding: 12,
    borderRadius: 5,
    width: '40%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  locationButton: {
    backgroundColor: '#005BBB',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    marginTop: 20,
    marginBottom: 60,
  },
  locationButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  caregiverInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  caregiverInfoContent: {
    marginLeft: 15,
    flex: 1,
  },
  caregiverInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#005BBB',
    marginBottom: 5,
  },
  caregiverInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  caregiverInfoEmail: {
    fontSize: 14,
    color: '#777',
  },
  noCaregiverCard: {
    backgroundColor: '#FFF8F8',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD7D7',
    elevation: 1,
  },
  noCaregiverText: {
    fontSize: 14,
    color: '#FF6347',
    marginLeft: 10,
    flex: 1,
  },
  caregiverBadge: {
    backgroundColor: '#005BBB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    position: 'absolute',
    top: -5,
    right: -5,
  },
  caregiverBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  contactEmail: {
    fontSize: 12,
    color: '#777',
    marginBottom: 5,
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#F0F8FF',
    padding: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#005BBB',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#005BBB',
  },
  checkboxLabel: {
    color: '#2C3E50',
    fontSize: 14,
  },
});

export default CaregiverScreen;
