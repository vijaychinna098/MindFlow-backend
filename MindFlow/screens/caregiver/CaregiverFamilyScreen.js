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
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCaregiver } from "../../CaregiverContext";
import { useFamily } from "../../context/FamilyContext";
import { useFontSize } from "./CaregiverFontSizeContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default images for gender
const FEMALE_DEFAULT_PHOTO = require('../images/girl.jpg'); // female placeholder
const MALE_DEFAULT_PHOTO   = require('../images/boy.png');  // male placeholder

// Sample contacts including gender field
const initialContacts = [
  {
    id: '1',
    name: 'Mom',
    relationship: 'Mother',
    gender: 'female',
    photo: '',
    emergency: false,
    note: 'You went to Goa with her in 2019.',
    phone: '+15551234567',
  },
  {
    id: '2',
    name: 'Ramesh',
    relationship: 'Son',
    gender: 'male',
    photo: '',
    emergency: false,
    note: 'Your beloved son.',
    phone: '+15557654321',
  },
  {
    id: '3',
    name: 'Dr. Smith',
    relationship: 'Doctor',
    gender: 'male',
    photo: '',
    emergency: true,
    note: 'Primary Caregiver',
    phone: '+15559876543',
  },
  {
    id: '4',
    name: 'Alex',
    relationship: 'Caregiver',
    gender: 'male',
    photo: '',
    emergency: false,
    note: 'Always here to help.',
    phone: '+15552345678',
  },
];

// Helper function to convert phone number into spoken digits
const getPhoneDigitsSpeech = (phone) => {
  if (!phone) return '';
  const digitMap = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
    '+': 'plus'
  };
  return phone
    .split('')
    .map(char => digitMap[char] || char)
    .join(' ');
};

const CaregiverFamilyScreen = () => {
  const { caregiver, activePatient } = useCaregiver();
  const { familyMembers, setFamilyMembers } = useFamily();
  const { fontSize } = useFontSize();
  
  // Use local state to ensure data isolation
  const [localFamilyMembers, setLocalFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPatientId, setCurrentPatientId] = useState(null);
  
  // Use currentUser.name from ProfileScreen (or fallback to "User")
  const username = caregiver && caregiver.name ? caregiver.name : 'User';
  const [language, setLanguage] = useState('en');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
    gender: 'female',
    note: '',
    photo: '',
    emergency: false,
  });

  // State for full-screen image modal and selected contact
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalContact, setModalContact] = useState(null);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);

  // Load voice assistance setting
  useEffect(() => {
    const loadVoiceAssistanceSetting = async () => {
      try {
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        setVoiceAssistanceEnabled(storedVoiceAssistance === 'true');
        console.log("Voice assistance is", storedVoiceAssistance === 'true' ? "enabled" : "disabled");
      } catch (error) {
        console.error('Error loading voice assistance setting:', error);
      }
    };
    
    loadVoiceAssistanceSetting();
  }, []);

  // Robust function to load family members from storage
  const loadFamilyMembersFromStorage = async () => {
    try {
      setIsLoading(true);
      
      if (!activePatient || !activePatient.email) {
        console.log("FAMILY_SCREEN - No active patient to load family members for");
        setLocalFamilyMembers([]);
        setIsLoading(false);
        return;
      }
      
      // Store current patient ID for comparison
      const patientId = activePatient.email.toLowerCase().trim();
      setCurrentPatientId(patientId);
      
      // Use direct patient key
      const patientKey = `family_${patientId}`;
      console.log(`FAMILY_SCREEN - Loading family members for patient key: ${patientKey}`);
      
      // Force a fresh read from AsyncStorage
      const stored = await AsyncStorage.getItem(patientKey);
      if (!stored) {
        console.log(`FAMILY_SCREEN - No family members found in storage for ${patientKey}`);
        setLocalFamilyMembers([]);
        setIsLoading(false);
        return;
      }
      
      try {
        const parsedMembers = JSON.parse(stored);
        console.log(`FAMILY_SCREEN - Found ${parsedMembers.length} family members in storage`);
        
        // Verify members belong to this patient only
        const validMembers = parsedMembers.filter(member => 
          member.forPatient && 
          member.forPatient.toLowerCase().trim() === patientId
        );
        
        if (validMembers.length !== parsedMembers.length) {
          console.log(`FAMILY_SCREEN - Filtered out ${parsedMembers.length - validMembers.length} family members that didn't belong to this patient`);
          
          // Save the filtered list back to storage
          await AsyncStorage.setItem(patientKey, JSON.stringify(validMembers));
        }
        
        // Update both local state and context
        setLocalFamilyMembers(validMembers);
        setFamilyMembers(validMembers);
      } catch (parseError) {
        console.error("FAMILY_SCREEN - Error parsing stored family members:", parseError);
        setLocalFamilyMembers([]);
      }
    } catch (error) {
      console.error("FAMILY_SCREEN - Error loading family members from storage:", error);
      setLocalFamilyMembers([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load family members when component mounts or when activePatient changes
  useEffect(() => {
    console.log("FAMILY_SCREEN - Active patient changed, loading family members");
    // Reset states when patient changes
    setLocalFamilyMembers([]);
    
    // Short delay before loading data to ensure state resets properly
    setTimeout(() => {
      loadFamilyMembersFromStorage();
    }, 50);
  }, [activePatient?.email]); // Only reload when the email changes
  
  // Update local state when context family members change
  useEffect(() => {
    if (Array.isArray(familyMembers) && familyMembers.length > 0) {
      // Only update if the family members are for the current patient
      if (activePatient?.email?.toLowerCase().trim() === currentPatientId) {
        console.log(`FAMILY_SCREEN - Context family members changed, updating local state with ${familyMembers.length} members`);
        setLocalFamilyMembers(familyMembers);
      }
    }
  }, [familyMembers, currentPatientId]);

  // Open the full-screen modal and speak contact details
  const openImageModal = (contact) => {
    setModalContact(contact);
    setImageModalVisible(true);
    
    // Only speak if voice assistance is enabled
    if (voiceAssistanceEnabled) {
      // Determine pronoun based on gender
      const pronoun = contact.gender === 'female' ? 'she is' : 'he is';
      const phoneSpeech = getPhoneDigitsSpeech(contact.phone);
      // Construct the message: "Hey [username], he/she is [contact name]. Phone number is [digit by digit]. He/She is ur [relationship]. [note]"
      const message = `Hey ${username}, ${pronoun} ${contact.name}. Phone number is ${phoneSpeech}. ${pronoun} your ${contact.relationship}. ${contact.note}`;
      Speech.speak(message, { language, rate: 0.9 });
    }
  };

  // Close the full-screen modal and stop speech
  const closeImageModal = () => {
    Speech.stop();
    setModalContact(null);
    setImageModalVisible(false);
  };

  // Voice assistance for other interactions (if needed)
  const handleContactPress = (contact) => {
    if (voiceAssistanceEnabled) {
      const message = `You are calling your ${contact.relationship}, ${contact.name}. ${contact.note}`;
      Speech.speak(message, { language, rate: 0.9 });
      Alert.alert("Voice Assistance", message, [{ text: "OK", onPress: () => Speech.stop() }]);
    } else {
      // Just show a regular alert without speech if voice assistance is disabled
      Alert.alert("Calling Contact", `Calling ${contact.name} (${contact.relationship})`, [{ text: "OK" }]);
    }
  };

  const handleDeleteContact = (id) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsLoading(true);
            const updatedMembers = localFamilyMembers.filter(c => c.id !== id);
            setLocalFamilyMembers(updatedMembers);
            setFamilyMembers(updatedMembers);
            
            // Also delete from patient's storage
            saveFamilyToPatient(updatedMembers);
            
            setIsLoading(false);
            
            // Show confirmation with patient info if there's an active patient
            if (activePatient) {
              Alert.alert(
                "Family Member Deleted", 
                `The family member has been removed from ${activePatient.name || activePatient.email}'s profile.`
              );
            }
          }
        },
      ]
    );
  };

  const openAddModal = () => {
    setEditingContact(null);
    setNewContact({
      name: '',
      phone: '',
      relationship: '',
      gender: 'female',
      note: '',
      photo: '',
      emergency: false,
    });
    setIsModalVisible(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setNewContact(contact);
    setIsModalVisible(true);
  };

  const pickImage = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Permission to access gallery was denied');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewContact({ ...newContact, photo: result.assets[0].uri });
    }
  };

  const handleSaveContact = () => {
    const { name, phone, relationship, gender } = newContact;
    if (!name || !phone || !relationship) {
      Alert.alert('Missing Fields', 'Please fill in name, phone, and relationship');
      return;
    }

    // Properly handle photo data depending on whether it's a URI string or a require'd asset
    let finalPhoto;
    if (newContact.photo) {
      // Keep URI strings as is
      finalPhoto = newContact.photo;
    } else {
      // For default photos, just store gender so we can display the correct default
      finalPhoto = ''; // Store empty, we'll use gender to determine which default to show
    }

    const contactToSave = {
      ...newContact,
      photo: finalPhoto,
    };

    let updatedFamilyMembers;
    if (editingContact) {
      updatedFamilyMembers = familyMembers.map((c) => (c.id === editingContact.id ? {
        ...contactToSave,
        id: editingContact.id,
        forPatient: activePatient?.email?.toLowerCase().trim()
      } : c));
      setFamilyMembers(updatedFamilyMembers);
    } else {
      const newId = Date.now().toString();
      const newContact = {
        ...contactToSave,
        id: newId,
        forPatient: activePatient?.email?.toLowerCase().trim(),
        createdBy: caregiver?.email || "unknown",
        createdAt: new Date().toISOString()
      };
      updatedFamilyMembers = [...familyMembers, newContact];
      setFamilyMembers(updatedFamilyMembers);
    }

    // Also save directly to patient's storage
    saveFamilyToPatient(updatedFamilyMembers);

    setIsModalVisible(false);
    setEditingContact(null);
    setNewContact({
      name: '',
      phone: '',
      relationship: '',
      gender: 'female',
      note: '',
      photo: '',
      emergency: false,
    });

    // Show confirmation with patient info if there's an active patient
    if (activePatient) {
      Alert.alert(
        "Family Member Added", 
        `The family member has been ${editingContact ? 'updated' : 'added'} for ${activePatient.name || activePatient.email}.`
      );
    }
  };

  // Save family members directly to patient's storage
  const saveFamilyToPatient = async (familyMembers) => {
    try {
      if (!activePatient?.email) {
        console.log("No active patient to save family members for");
        return;
      }
      
      const patientEmail = activePatient.email.toLowerCase().trim();
      const patientStorageKey = `family_${patientEmail}`;
      
      // Ensure family members are properly tagged with patient ID
      const patientFamilyMembers = familyMembers.map(member => ({
        ...member,
        forPatient: patientEmail
      }));
      
      // Save family members to patient storage
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientFamilyMembers));
      console.log(`Saved ${patientFamilyMembers.length} family members directly to patient's storage`);
      
      // Create mapping between caregiver and patient for family
      await AsyncStorage.setItem(`family_mapping_${patientEmail}`, caregiver?.email || "");
      console.log(`Created family mapping from patient ${patientEmail} to caregiver ${caregiver?.email}`);
      
    } catch (error) {
      console.error("Failed to save family members to patient storage:", error);
    }
  };

  const renderContact = ({ item }) => {
    let contactPhoto;
    if (item.photo) {
      // Fix the image source handling
      contactPhoto = typeof item.photo === 'string'
        ? { uri: item.photo }
        : item.photo;
    } else {
      // Directly use the require statement for default photos
      contactPhoto = (item.gender === 'female') ? FEMALE_DEFAULT_PHOTO : MALE_DEFAULT_PHOTO;
    }

    return (
      <View style={[styles.contactCard, item.emergency && styles.emergencyCard]}>
        {/* Tapping the image opens full-screen and starts speaking details */}
        <TouchableOpacity onPress={() => openImageModal(item)}>
          <Image source={contactPhoto} style={styles.contactImage} />
        </TouchableOpacity>
        <Text style={[styles.contactName, { fontSize: fontSize + 2 }]}>{item.name}</Text>
        <Text style={[styles.contactRelation, { fontSize }]}>{item.relationship}</Text>
        {item.note ? <Text style={[styles.contactNote, { fontSize: fontSize - 2 }]}>{item.note}</Text> : null}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
            <Ionicons name="create" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteContact(item.id)}>
            <Ionicons name="trash" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { fontSize: fontSize + 8 }]}>Family Contacts</Text>
      {activePatient ? (
        <View style={styles.patientInfoBox}>
          <Ionicons name="person" size={24} color="#005BBB" style={styles.patientIcon} />
          <Text style={[styles.patientInfoText, { fontSize }]}>
            Managing family members for {activePatient.name || activePatient.email}
          </Text>
        </View>
      ) : (
        <View style={styles.patientInfoBox}>
          <Ionicons name="alert-circle" size={24} color="#FFA500" style={styles.patientIcon} />
          <Text style={[styles.patientInfoText, { fontSize }]}>
            No active patient selected. Please select a patient first.
          </Text>
        </View>
      )}
      
      <FlatList
        data={localFamilyMembers}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        style={styles.contactsList}
        contentContainerStyle={styles.contactsListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No family members yet</Text>
            {activePatient ? (
              <Text style={styles.emptySubText}>
                Add family members for {activePatient.name || activePatient.email} to help them stay connected
              </Text>
            ) : (
              <Text style={styles.emptySubText}>
                Please select an active patient first before adding family members
              </Text>
            )}
          </View>
        }
      />
      
      {activePatient && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingContact(null);
            setNewContact({
              name: '',
              phone: '',
              relationship: '',
              gender: 'female',
              note: '',
              photo: '',
              emergency: false,
            });
            setIsModalVisible(true);
          }}
        >
          <Ionicons name="add-circle" size={30} color="#005BBB" />
          <Text style={styles.addButtonText}>Add Family Member</Text>
        </TouchableOpacity>
      )}

      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add New Contact'}</Text>
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
              placeholder="Relationship (e.g., Son, Caregiver)"
              style={styles.input}
              value={newContact.relationship}
              onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
            />
            <Picker
              selectedValue={newContact.gender}
              style={styles.input}
              onValueChange={(value) => setNewContact({ ...newContact, gender: value })}
            >
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Male" value="male" />
            </Picker>
            <TextInput
              placeholder="Note (Optional)"
              style={styles.input}
              value={newContact.note}
              onChangeText={(text) => setNewContact({ ...newContact, note: text })}
            />
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Text style={styles.photoButtonText}>Choose Photo</Text>
            </TouchableOpacity>
            {newContact.photo ? (
              <Image source={{ uri: newContact.photo }} style={styles.previewImage} />
            ) : null}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setIsModalVisible(false);
                  setEditingContact(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveContact}>
                <Text style={styles.modalButtonText}>{editingContact ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Full-screen image modal with custom speech */}
      <Modal visible={imageModalVisible} transparent={true} animationType="fade">
        <View style={styles.fullScreenModal}>
          {modalContact && (
            <>
              <TouchableOpacity style={styles.closeButton} onPress={closeImageModal}>
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              <Image
                source={
                  modalContact.photo
                    ? (typeof modalContact.photo === 'string'
                        ? { uri: modalContact.photo }
                        : modalContact.photo)
                    : (modalContact.gender === 'female'
                        ? FEMALE_DEFAULT_PHOTO
                        : MALE_DEFAULT_PHOTO)
                }
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
              <View style={styles.infoOverlay}>
                <ScrollView>
                  <Text style={styles.infoText}>Name: {modalContact.name}</Text>
                  <Text style={styles.infoText}>Phone: {modalContact.phone}</Text>
                  <Text style={styles.infoText}>Relationship: {modalContact.relationship}</Text>
                  <Text style={styles.infoText}>Gender: {modalContact.gender}</Text>
                  {modalContact.note ? <Text style={styles.infoText}>Note: {modalContact.note}</Text> : null}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', paddingTop: 40, paddingHorizontal: 10 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#005BBB', textAlign: 'center', marginBottom: 20 },
  picker: { width: 150, height: 40 },
  contactsList: { },
  contactsListContent: { justifyContent: 'space-between' },
  contactCard: { 
    backgroundColor: '#fff', 
    borderRadius: 15, 
    padding: 16, 
    margin: 8, 
    alignItems: 'center', 
    flex: 1, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    minHeight: 220
  },
  emergencyCard: { borderWidth: 2, borderColor: 'red' },
  contactImage: { width: 130, height: 130, borderRadius: 65, marginBottom: 15 },
  contactName: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50' },
  contactRelation: { fontSize: 18, color: '#005BBB', marginTop: 2 },
  contactNote: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 8 },
  actionsRow: { flexDirection: 'row', marginTop: 15 },
  actionButton: { 
    backgroundColor: '#005BBB', 
    padding: 10, 
    borderRadius: 25, 
    marginHorizontal: 8,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  addButtonText: { marginLeft: 10, fontSize: 18, color: '#005BBB', fontWeight: 'bold' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 10, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#F0F4F8', borderRadius: 5, padding: 10, marginVertical: 5 },
  photoButton: { backgroundColor: '#005BBB', padding: 10, borderRadius: 5, marginVertical: 10 },
  photoButtonText: { color: '#fff', textAlign: 'center' },
  previewImage: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center', marginVertical: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  modalButton: { padding: 10, borderRadius: 5, backgroundColor: '#005BBB', flex: 1, marginHorizontal: 5, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16 },
  // Full-screen modal styles
  fullScreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: { width: '100%', height: '80%' },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
  },
  infoText: { color: '#fff', fontSize: 16, marginVertical: 2 },
  closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  patientInfoBox: { 
    backgroundColor: "#E8F4FF", 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center" 
  },
  patientInfoText: { 
    fontSize: 14, 
    color: "#005BBB",
    flex: 1
  },
  patientIcon: {
    marginRight: 10
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#777',
  },
});

export default CaregiverFamilyScreen;
