import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Linking, 
  StyleSheet, 
  Modal, 
  TextInput, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCaregiver } from "../../CaregiverContext";
import { EmergencyContactsContext, useEmergencyContacts } from "../../context/EmergencyContactsContext";
import { useFontSize } from "./CaregiverFontSizeContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const defaultContacts = [
  { id: '1', name: 'John Doe', number: '+123456789', relation: 'Father' },
  { id: '2', name: 'Jane Doe', number: '+987654321', relation: 'Mother' },
  { id: '3', name: 'Alex Smith', number: '+1122334455', relation: 'Sibling' },
];

const CaregiverEmergencyContacts = () => {
  const navigation = useNavigation();
  const { caregiver, activePatient } = useCaregiver();
  const { fontSize } = useFontSize();
  
  // Use a try-catch block to handle potential errors with the context
  let contacts = [];
  let activePatientContacts = [];
  let setContacts = () => {};
  
  try {
    // Try to use the custom hook for emergency contacts
    const emergencyContactsData = useEmergencyContacts();
    contacts = emergencyContactsData?.contacts || [];
    setContacts = emergencyContactsData?.setContacts || (() => {});
    
    // Filter contacts to show only those for the active patient
    if (activePatient?.email) {
      const patientEmail = activePatient.email.toLowerCase().trim();
      activePatientContacts = contacts.filter(contact => 
        contact.forPatient === patientEmail
      );
    }
  } catch (error) {
    console.log("Error accessing EmergencyContactsContext:", error.message);
    // Fall back to default empty values
  }
  
  const [modalVisible, setModalVisible] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    number: '',
    relation: '',
  });

  const handleCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const addContact = () => {
    if (!activePatient) {
      Alert.alert('Missing Information', 'No active patient selected.');
      return;
    }

    if (!newContact.name || !newContact.number || !newContact.relation) {
      Alert.alert('Missing Information', 'Please fill all fields.');
      return;
    }

    // Phone validation removed to allow any number format and length

    try {
      const { name, number, relation } = newContact;
      // Safely access activePatient and caregiver with optional chaining
      const patientEmail = activePatient?.email?.toLowerCase().trim() || "unknown";
      const caregiverEmail = caregiver?.email || "unknown";
      
      const contactToAdd = {
        id: Date.now().toString(),
        name,
        number,
        relation,
        forPatient: patientEmail,
        createdBy: caregiverEmail,
        createdAt: new Date().toISOString()
      };
      
      const updatedContacts = [...contacts, contactToAdd];
      
      // Safely call setContacts
      if (typeof setContacts === 'function') {
        setContacts(updatedContacts);
      }
      
      // Also save directly to patient's storage
      saveEmergencyContactsToPatient(updatedContacts);
      
      setNewContact({ name: '', number: '', relation: '' });
      setModalVisible(false);
      
      // Show confirmation with patient info if there's an active patient
      if (activePatient) {
        Alert.alert(
          "Emergency Contact Added", 
          `The emergency contact has been added for ${activePatient.name || activePatient.email}.`
        );
      }
    } catch (error) {
      console.error("Error adding contact:", error);
      Alert.alert("Error", "Failed to add contact. Please try again later.");
    }
  };

  // Save emergency contacts directly to patient's storage
  const saveEmergencyContactsToPatient = async (contacts) => {
    try {
      if (!activePatient?.email) {
        console.log("No active patient to save emergency contacts for");
        return;
      }
      
      const patientEmail = activePatient.email.toLowerCase().trim();
      const patientStorageKey = `emergencyContacts_${patientEmail}`;
      
      // Filter only this patient's contacts to save
      const patientContacts = contacts.filter(contact => 
        contact.forPatient === patientEmail
      );
      
      // Save contacts to patient storage
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientContacts));
      console.log(`Saved ${patientContacts.length} emergency contacts directly to patient's storage`);
      
      // Safely access caregiver email with optional chaining
      const caregiverEmail = caregiver?.email || "unknown";
      
      // Create mapping between caregiver and patient for emergency contacts
      await AsyncStorage.setItem(`emergency_mapping_${patientEmail}`, caregiverEmail);
      console.log(`Created emergency contacts mapping from patient ${patientEmail} to caregiver ${caregiverEmail}`);
      
    } catch (error) {
      console.error("Failed to save emergency contacts to patient storage:", error);
    }
  };

  const deleteContact = (id) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            try {
              // First make sure we have the active patient
              if (!activePatient?.email) {
                Alert.alert("Error", "No active patient selected.");
                return;
              }
              
              const patientEmail = activePatient.email.toLowerCase().trim();
              
              // Remove the contact from the global contacts list
              const updatedContacts = contacts.filter(contact => contact.id !== id);
              
              // Safely call setContacts to update the full contacts list
              if (typeof setContacts === 'function') {
                setContacts(updatedContacts);
              }
              
              // Update the patient's specific storage
              const patientContacts = updatedContacts.filter(
                contact => contact.forPatient === patientEmail
              );
              saveEmergencyContactsToPatient(patientContacts);
              
              // Show confirmation
              Alert.alert(
                "Emergency Contact Deleted", 
                `The emergency contact has been removed from ${activePatient.name || activePatient.email}'s profile.`
              );
            } catch (error) {
              console.error("Error deleting contact:", error);
              Alert.alert("Error", "Failed to delete contact. Please try again later.");
            }
          }
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactDetails}>
        <Text style={[styles.contactName, { fontSize: fontSize + 2 }]}>{item.name}</Text>
        <Text style={[styles.contactRelation, { fontSize }]}>{item.relation}</Text>
        <Text style={[styles.contactNumber, { fontSize }]}>{item.number}</Text>
      </View>
      <View style={styles.iconContainer}>
        <TouchableOpacity onPress={() => handleCall(item.number)} style={styles.callButton}>
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteContact(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash" size={24} color="#D9534F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { fontSize: fontSize + 4 }]}>Emergency Contacts</Text>
      
      {!activePatient ? (
        <View style={styles.noPatientContainer}>
          <Ionicons name="person-outline" size={50} color="#005BBB" style={styles.noPatientIcon} />
          <Text style={[styles.noPatientText, { fontSize: fontSize + 2 }]}>No patient connected</Text>
          <Text style={[styles.noPatientSubText, { fontSize }]}>Please connect and select an active patient from the Patients screen to manage emergency contacts.</Text>
          <TouchableOpacity 
            style={styles.connectPatientButton}
            onPress={() => navigation.navigate("CaregiverPatients")}
          >
            <Text style={[styles.connectPatientButtonText, { fontSize }]}>Connect Patient</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.patientInfoBox}>
            <Ionicons name="person" size={24} color="#005BBB" style={styles.patientIcon} />
            <Text style={[styles.patientInfoText, { fontSize }]}>
              Managing emergency contacts for {activePatient.name || activePatient.email}
            </Text>
          </View>
          
          {!activePatientContacts || activePatientContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { fontSize: fontSize + 2 }]}>No emergency contacts yet</Text>
              <Text style={[styles.emptySubText, { fontSize }]}>
                Add emergency contacts for {activePatient.name || activePatient.email} to help in case of emergency
              </Text>
            </View>
          ) : (
            <FlatList 
              data={activePatientContacts}
              renderItem={renderItem}
              keyExtractor={(item) => item?.id || Math.random().toString()}
              contentContainerStyle={styles.contactsListContent}
            />
          )}
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle" size={30} color="#FFF" />
            <Text style={[styles.addButtonText, { fontSize }]}>Add Emergency Contact</Text>
          </TouchableOpacity>
        </>
      )}
      
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { fontSize: fontSize + 2 }]}>
              {activePatient 
                ? `New Emergency Contact for ${activePatient.name || activePatient.email}` 
                : "New Emergency Contact"}
            </Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              placeholder="Name"
              value={newContact.name}
              onChangeText={(text) => setNewContact({...newContact, name: text})}
            />
            <TextInput
              style={[styles.input, { fontSize }]}
              placeholder="Phone Number"
              value={newContact.number}
              onChangeText={(text) => setNewContact({...newContact, number: text})}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, { fontSize }]}
              placeholder="Relationship"
              value={newContact.relation}
              onChangeText={(text) => setNewContact({...newContact, relation: text})}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.buttonText, { fontSize }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.addModalButton]}
                onPress={addContact}
              >
                <Text style={[styles.buttonText, { fontSize }]}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2C3E50',
  },
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
    paddingVertical: 40,
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  contactRelation: {
    fontSize: 14,
    color: '#005BBB',
    marginTop: 2,
  },
  contactNumber: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  iconContainer: {
    flexDirection: 'row',
  },
  callButton: {
    backgroundColor: '#005BBB',
    padding: 10,
    borderRadius: 25,
    marginLeft: 10,
  },
  deleteButton: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 25,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#D9534F',
  },
  addButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2C3E50',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  addModalButton: {
    backgroundColor: '#005BBB',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  contactsListContent: {
    flexGrow: 1,
  },
  noPatientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noPatientIcon: {
    marginBottom: 10,
  },
  noPatientText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  noPatientSubText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
  },
  connectPatientButton: {
    backgroundColor: '#005BBB',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  connectPatientButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CaregiverEmergencyContacts;
