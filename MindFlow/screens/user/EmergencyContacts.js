import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Linking, 
  StyleSheet, 
  Alert,
  Image,
  ActivityIndicator,
  Button
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from "../../UserContext";
import { checkNeedsSyncFromCaregiver, syncPatientDataFromCaregiver } from '../../services/DataSynchronizationService';

const EmergencyContacts = () => {
  const { currentUser } = useUser();
  const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
  const storageKey = userEmail ? `emergencyContacts_${userEmail}` : 'emergencyContacts';
  const [contacts, setContacts] = useState([]);
  const [connectedCaregiverEmail, setConnectedCaregiverEmail] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const checkCaregiverConnection = async () => {
      if (!userEmail) return;
      
      try {
        setIsLoading(true);
        
        // Check if this user is connected to a caregiver using the mapping
        const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
        const mappings = JSON.parse(caregiverPatientsMap);
        
        // Direct lookup by user email
        const caregiverEmail = mappings[userEmail];
        
        if (caregiverEmail) {
          console.log(`User is connected to caregiver: ${caregiverEmail}`);
          setConnectedCaregiverEmail(caregiverEmail);
          
          // Check if data needs to be synced
          const { needsSync } = await checkNeedsSyncFromCaregiver(userEmail);
          
          if (needsSync) {
            console.log('Emergency contacts need sync from caregiver');
            await performSync(caregiverEmail);
          } else {
            // Still try to load the contacts
            await loadContacts();
          }
        } else {
          console.log('No caregiver connection found, loading local contacts');
          await loadContacts();
        }
      } catch (error) {
        console.error('Error checking caregiver connection:', error);
        await loadContacts(); // Fallback to loading local contacts
      } finally {
        setIsLoading(false);
      }
    };
    
    checkCaregiverConnection();
  }, [userEmail]);
  
  const performSync = async (caregiverEmail) => {
    if (!caregiverEmail || !userEmail) return;
    
    try {
      setIsSyncing(true);
      console.log(`Syncing emergency contacts from caregiver: ${caregiverEmail}`);
      
      const syncSuccess = await syncPatientDataFromCaregiver(userEmail, caregiverEmail);
      
      if (syncSuccess) {
        console.log('Sync completed successfully');
        setLastSyncTime(new Date().toLocaleString());
        
        // Reload contacts after sync
        await loadContacts();
      } else {
        console.log('Sync failed');
        Alert.alert(
          'Sync Failed',
          'Unable to sync contacts from your caregiver. Please try again later.'
        );
      }
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const loadContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem(storageKey);
      if (storedContacts) {
        const parsedContacts = JSON.parse(storedContacts);
        
        // Filter to ensure only contacts for this user are shown
        const userContacts = parsedContacts.filter(contact => 
          contact && 
          (!contact.forPatient || contact.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim())
        );
        
        setContacts(userContacts);
        console.log(`Loaded ${userContacts.length} emergency contacts specific to user: ${userEmail}`);
      } else {
        setContacts([]);
        console.log('No emergency contacts found');
      }
      
      // Check last sync time
      if (userEmail) {
        const lastSync = await AsyncStorage.getItem(`lastSync_${userEmail}`);
        if (lastSync) {
          setLastSyncTime(new Date(lastSync).toLocaleString());
        }
      }
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
      setContacts([]);
    }
  };

  const handleCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleSync = async () => {
    if (!connectedCaregiverEmail) {
      Alert.alert(
        'No Caregiver Connected',
        'You are not connected to a caregiver who can set emergency contacts for you.'
      );
      return;
    }
    
    Alert.alert(
      'Sync Contacts',
      'Sync emergency contacts from your caregiver?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync Now', 
          onPress: async () => {
            await performSync(connectedCaregiverEmail);
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#005BBB" />
        <Text style={styles.loadingText}>Loading emergency contacts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        {connectedCaregiverEmail && (
          <TouchableOpacity 
            style={styles.syncButton} 
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sync" size={16} color="#FFFFFF" />
                <Text style={styles.syncButtonText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {connectedCaregiverEmail && (
        <Text style={styles.syncInfo}>
          {lastSyncTime ? `Last synced: ${lastSyncTime}` : 'Not synced yet'}
        </Text>
      )}
      
      {contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="call-outline" size={64} color="#cccccc" />
          <Text style={styles.emptyText}>No emergency contacts</Text>
          {connectedCaregiverEmail ? (
            <>
              <Text style={styles.emptySubtext}>
                Your caregiver can add emergency contacts for you.
              </Text>
              <TouchableOpacity 
                style={styles.syncEmptyButton}
                onPress={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.syncEmptyButtonText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptySubtext}>
              You need to connect with a caregiver who can set up emergency contacts for you.
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.contactItem}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactNumber}>{item.number}</Text>
                <Text style={styles.contactRelation}>{item.relation}</Text>
                {item.addedByCaregiver && (
                  <View style={styles.caregiverBadge}>
                    <Text style={styles.caregiverBadgeText}>Added by caregiver</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(item.number)}
              >
                <Ionicons name="call" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005BBB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  syncButtonText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontSize: 12,
  },
  syncInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#555',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  syncEmptyButton: {
    backgroundColor: '#005BBB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  syncEmptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  contactNumber: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  contactRelation: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  caregiverBadge: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  caregiverBadgeText: {
    fontSize: 10,
    color: '#005BBB',
  },
  callButton: {
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: 16,
  },
});

export default EmergencyContacts;
