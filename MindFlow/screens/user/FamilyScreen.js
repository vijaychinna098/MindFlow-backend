import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from "../../UserContext";
import { stopSpeech, speakWithVoiceCheck, getVoiceLanguage } from '../../utils/SpeechManager';
import { useFontSize } from '../user/FontSizeContext'; // Updated import path

// Default images for gender
const FEMALE_DEFAULT_PHOTO = require('../images/girl.jpg'); // female placeholder
const MALE_DEFAULT_PHOTO   = require('../images/boy.png');  // male placeholder

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

const FamilyScreen = () => {
  const { currentUser } = useUser();
  // Use the fontSize context
  const { fontSize } = useFontSize();
  
  // Use currentUser.name from ProfileScreen (or fallback to "User")
  const username = currentUser && currentUser.name ? currentUser.name : 'User';
  const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
  const storageKey = userEmail ? `family_${userEmail}` : 'family';
  
  // All useState hooks must be declared before any useEffect hooks
  const [connectedCaregiverEmail, setConnectedCaregiverEmail] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalContact, setModalContact] = useState(null);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  // Check for connected caregiver
  useEffect(() => {
    const checkCaregiverConnection = async () => {
      if (!userEmail) return;
      
      try {
        // Check if this user is connected to a caregiver
        const mappingKey = `family_mapping_${userEmail}`;
        const caregiverEmail = await AsyncStorage.getItem(mappingKey);
        
        if (caregiverEmail) {
          console.log(`User family members connected to caregiver: ${caregiverEmail}`);
          setConnectedCaregiverEmail(caregiverEmail);
          
          // Check if caregiver has family members for this patient
          await checkCaregiverFamilyMembers(caregiverEmail);
        }
      } catch (error) {
        console.error("Failed to check caregiver connection for family members:", error);
      }
    };
    
    checkCaregiverConnection();
  }, [userEmail]);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const savedContacts = await AsyncStorage.getItem(storageKey);
        if (savedContacts !== null) {
          const parsedContacts = JSON.parse(savedContacts);
          
          // Filter to ensure only family members for this user are shown
          const userContacts = parsedContacts.filter(contact => 
            contact && 
            (!contact.forPatient || contact.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim())
          );
          
          setContacts(userContacts);
          console.log(`Loaded ${userContacts.length} family members specific to user: ${userEmail}`);
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    };
    loadContacts();

    // Clean up speech when component unmounts
    return () => {
      stopSpeech();
    };
  }, [storageKey, userEmail]);

  // Function to check if caregiver has set family members for this patient
  const checkCaregiverFamilyMembers = async (caregiverEmail) => {
    if (!caregiverEmail || !userEmail) return;
    
    try {
      // Check caregiver's family members
      const caregiverKey = `family_${caregiverEmail}`;
      const caregiverFamilyData = await AsyncStorage.getItem(caregiverKey);
      
      if (caregiverFamilyData) {
        const allCaregiverFamilyMembers = JSON.parse(caregiverFamilyData);
        console.log(`Found ${allCaregiverFamilyMembers.length} total family members from caregiver`);
        
        // Filter to only include family members for this specific user
        const userFamilyMembers = allCaregiverFamilyMembers.filter(member => 
          member && 
          member.forPatient && 
          member.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim()
        );
        
        console.log(`Filtered to ${userFamilyMembers.length} family members assigned to this user`);
        
        // Update our family members from caregiver's list
        if (userFamilyMembers.length > 0) {
          // Save to user's own storage to maintain persistence
          await AsyncStorage.setItem(storageKey, JSON.stringify(userFamilyMembers));
          
          // Update state
          setContacts(userFamilyMembers);
          setLastSyncTime(new Date().toLocaleString());
          console.log("Synced user-specific family members from caregiver");
        }
      }
    } catch (error) {
      console.error("Failed to fetch caregiver family members:", error);
    }
  };

  // Open the full-screen modal and speak contact details
  const openImageModal = (contact) => {
    setModalContact(contact);
    setImageModalVisible(true);
    
    // Only speak if voice assistance is enabled
    if (voiceAssistanceEnabled) {
      speakContactDetails(contact);
    }
  };

  // Function to speak contact details
  const speakContactDetails = (contact) => {
    // Determine pronoun based on gender
    const pronoun = contact.gender === 'female' ? 'she is' : 'he is';
    const phoneSpeech = getPhoneDigitsSpeech(contact.phone);
    // Construct the message: "Hey [username], he/she is [contact name]. Phone number is [digit by digit]. He/She is ur [relationship]. [note]"
    const message = `Hey ${username}, ${pronoun} ${contact.name}. Phone number is ${phoneSpeech}. ${pronoun} your ${contact.relationship}. ${contact.note || ''}`;
    
    // Set speaking state to true
    setIsSpeaking(true);
    
    // Use speakWithVoiceCheck with a callback when finished
    speakWithVoiceCheck(message, true, true);
    
    // Set up a timer to check if speech has completed after a reasonable time
    // Based on the length of the message (average person speaks ~150 words per minute)
    const wordCount = message.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60 * 1000; // convert to milliseconds
    
    setTimeout(() => {
      setIsSpeaking(false);
    }, estimatedDuration + 2000); // Add 2 seconds buffer
  };

  // Toggle speaking (start or stop)
  const toggleSpeaking = () => {
    if (isSpeaking) {
      // Stop speaking if currently speaking
      stopSpeech();
      setIsSpeaking(false);
    } else if (modalContact && voiceAssistanceEnabled) {
      // Start speaking if not speaking
      speakContactDetails(modalContact);
    } else if (!voiceAssistanceEnabled) {
      // Alert the user that voice assistance is disabled
      Alert.alert(
        "Voice Assistance Disabled",
        "Enable voice assistance in settings to use this feature.",
        [{ text: "OK" }]
      );
    }
  };

  // Close the full-screen modal and stop speech
  const closeImageModal = () => {
    stopSpeech();
    setIsSpeaking(false);
    setModalContact(null);
    setImageModalVisible(false);
  };

  // Initiate phone call
  const callContact = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert(
        "No Phone Number", 
        "This contact doesn't have a phone number."
      );
    }
  };

  const renderContact = ({ item }) => {
    // Choose default photo based on gender if no photo is provided
    const defaultPhoto = item.gender === 'female' ? FEMALE_DEFAULT_PHOTO : MALE_DEFAULT_PHOTO;
    
    // Safely handle photo property - ensure it's a valid string URI
    let photoSource = defaultPhoto;
    if (item.photo && typeof item.photo === 'string' && item.photo.trim() !== '') {
      photoSource = { uri: item.photo };
    }
    
    return (
      <View style={styles.contactCard}>
        <TouchableOpacity 
          style={styles.contactImageContainer}
          onPress={() => openImageModal(item)}
        >
          <Image
            source={photoSource}
            style={styles.contactImage}
            defaultSource={defaultPhoto}
          />
        </TouchableOpacity>
        
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { fontSize: fontSize }]}>{item.name}</Text>
          <Text style={[styles.contactRelationship, { fontSize: fontSize - 2 }]}>
            Relationship: {item.relationship}
          </Text>
          <Text style={[styles.contactPhone, { fontSize: fontSize - 2 }]}>
            Phone: {item.phone}
          </Text>
          {item.emergency && (
            <View style={styles.emergencyTag}>
              <Text style={[styles.emergencyText, { fontSize: fontSize - 4 }]}>
                Emergency Contact
              </Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => callContact(item.phone)}
        >
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: fontSize + 4 }]}>Family and Contacts</Text>
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#005BBB" />
        <Text style={[styles.infoText, { fontSize: fontSize - 2 }]}>
          View-only mode. Family members are managed by your caregiver.
        </Text>
      </View>
      
      {contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { fontSize: fontSize }]}>No Contacts Found</Text>
          <Text style={[styles.emptySubText, { fontSize: fontSize - 2 }]}>Ask your caregiver to add family members for you.</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.contactsList}
        />
      )}
      
      {/* Full-screen contact modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        {modalContact && (
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeImageModal}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.modalContent}>
              <Image
                source={
                  (modalContact.photo && typeof modalContact.photo === 'string' && modalContact.photo.trim() !== '') 
                    ? { uri: modalContact.photo } 
                    : (modalContact.gender === 'female' ? FEMALE_DEFAULT_PHOTO : MALE_DEFAULT_PHOTO)
                }
                style={styles.modalImage}
                resizeMode="contain"
              />
              
              <View style={styles.modalInfo}>
                <Text style={[styles.modalName, { fontSize: fontSize + 4 }]}>{modalContact.name}</Text>
                <Text style={[styles.modalRelationship, { fontSize: fontSize }]}>{modalContact.relationship}</Text>
                <Text style={[styles.modalPhone, { fontSize: fontSize }]}>{modalContact.phone}</Text>
                {modalContact.note && (
                  <Text style={[styles.modalNote, { fontSize: fontSize - 2 }]}>{modalContact.note}</Text>
                )}
                {modalContact.emergency && (
                  <View style={styles.modalEmergencyTag}>
                    <Text style={[styles.modalEmergencyText, { fontSize: fontSize - 2 }]}>
                      Emergency Contact
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity 
                  style={styles.modalCallButton}
                  onPress={() => callContact(modalContact.phone)}
                >
                  <Ionicons name="call" size={24} color="#fff" />
                  <Text style={[styles.modalCallText, { fontSize: fontSize }]}>
                    Call
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalSpeakButton}
                  onPress={toggleSpeaking}
                >
                  <Ionicons 
                    name={isSpeaking ? "volume-high" : "volume-mute"} 
                    size={24} 
                    color="#fff" 
                  />
                  <Text style={[styles.modalSpeakText, { fontSize: fontSize }]}>
                    {isSpeaking ? "Stop" : "Speak"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F0F4F8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  infoBox: {
    backgroundColor: '#E8F4FF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#005BBB',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  infoText: {
    color: '#333',
    marginLeft: 10,
    textAlign: 'center',
    fontSize: 14,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  contactsList: {
    paddingBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 110
  },
  contactImageContainer: {
    marginRight: 20,
  },
  contactImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#005BBB',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3
  },
  contactRelationship: {
    fontSize: 16,
    color: '#666',
    marginTop: 3,
  },
  contactPhone: {
    fontSize: 16,
    color: '#005BBB',
    marginTop: 3,
  },
  emergencyTag: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  emergencyText: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  callButton: {
    backgroundColor: '#005BBB',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 30,
  },
  modalInfo: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalRelationship: {
    fontSize: 18,
    color: '#555',
    marginBottom: 5,
  },
  modalPhone: {
    fontSize: 18,
    color: '#005BBB',
    marginBottom: 10,
  },
  modalNote: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  modalEmergencyTag: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  modalEmergencyText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    marginTop: 30,
  },
  modalCallButton: {
    backgroundColor: '#28A745',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginRight: 15,
  },
  modalCallText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  modalSpeakButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  modalSpeakText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
});

export default FamilyScreen;
