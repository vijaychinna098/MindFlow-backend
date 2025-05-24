import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAllCaregiverData } from '../services/ServerSyncService';
import { normalizeEmail } from '../utils/helpers';

const CaregiverSyncIndicator = ({ caregiverEmail, patientEmail, style }) => {
  const [syncStatus, setSyncStatus] = useState('unknown'); // 'synced', 'syncing', 'error', 'unknown'
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [caregiverId, setCaregiverId] = useState(null);

  useEffect(() => {
    checkSyncStatus();
    loadCaregiverData();
  }, [caregiverEmail, patientEmail]);

  const loadCaregiverData = async () => {
    try {
      // First check current session data
      const caregiverData = await AsyncStorage.getItem('caregiverData');
      if (caregiverData) {
        const caregiver = JSON.parse(caregiverData);
        if (caregiver && caregiver.id) {
          setCaregiverId(caregiver.id);
          return;
        }
      }

      // Then try caregiver email specific data
      if (caregiverEmail) {
        const normalizedCaregiverEmail = normalizeEmail(caregiverEmail);
        const specificCaregiverData = await AsyncStorage.getItem(`caregiverData_${normalizedCaregiverEmail}`);
        if (specificCaregiverData) {
          const specificCaregiver = JSON.parse(specificCaregiverData);
          if (specificCaregiver && specificCaregiver.id) {
            setCaregiverId(specificCaregiver.id);
            return;
          }
        }
      }

      // Finally check all keys for any caregiverData
      const allKeys = await AsyncStorage.getAllKeys();
      const caregiverDataKeys = allKeys.filter(key => key.startsWith('caregiverData_'));
      
      for (const key of caregiverDataKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          try {
            const caregiver = JSON.parse(data);
            if (caregiver && caregiver.id) {
              setCaregiverId(caregiver.id);
              return;
            }
          } catch (error) {
            console.log('Error parsing caregiver data from key:', key);
          }
        }
      }
    } catch (error) {
      console.error('Error loading caregiver data:', error);
    }
  };

  const checkSyncStatus = async () => {
    if (!caregiverEmail || !patientEmail) {
      setSyncStatus('unknown');
      return;
    }

    try {
      const normalizedCaregiverEmail = normalizeEmail(caregiverEmail);
      const normalizedPatientEmail = normalizeEmail(patientEmail);
      
      const syncKey = `lastCaregiverSync_${normalizedCaregiverEmail}_${normalizedPatientEmail}`;
      const lastSync = await AsyncStorage.getItem(syncKey);
      
      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
        
        // Check if sync was recent (within last hour)
        const lastSyncDate = new Date(lastSync);
        const now = new Date();
        const diffMs = now - lastSyncDate;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 1) {
          setSyncStatus('synced');
        } else if (diffHours < 24) {
          setSyncStatus('stale');
        } else {
          setSyncStatus('old');
        }
      } else {
        setSyncStatus('never');
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      setSyncStatus('error');
    }
  };

  const handleSync = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setSyncStatus('syncing');
    
    try {
      // Get caregiver ID if not already loaded
      if (!caregiverId) {
        await loadCaregiverData();
      }
      
      if (!caregiverId) {
        console.error('Cannot sync without caregiver ID');
        setSyncStatus('error');
        setIsLoading(false);
        return;
      }
      
      const normalizedPatientEmail = normalizeEmail(patientEmail);
      
      console.log(`Starting manual sync for caregiver ${caregiverId} and patient ${normalizedPatientEmail}`);
      const result = await syncAllCaregiverData(caregiverId, normalizedPatientEmail);
      
      if (result.success) {
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        console.log('Manual sync completed successfully');
      } else {
        setSyncStatus('error');
        console.error('Sync error:', result.error);
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  let content;
  switch (syncStatus) {
    case 'synced':
      content = (
        <>
          <Ionicons name="cloud-done" size={16} color="#4CAF50" />
          <Text style={styles.syncedText}>Synced</Text>
          <Text style={styles.timeText}>
            {lastSyncTime ? `${lastSyncTime.toLocaleTimeString()}` : ''}
          </Text>
        </>
      );
      break;
    case 'stale':
      content = (
        <>
          <Ionicons name="cloud-outline" size={16} color="#FFA000" />
          <Text style={styles.staleText}>Sync needed</Text>
          <TouchableOpacity onPress={handleSync} disabled={isLoading}>
            <Text style={styles.syncNowText}>Sync now</Text>
          </TouchableOpacity>
        </>
      );
      break;
    case 'old':
      content = (
        <>
          <Ionicons name="cloud-offline" size={16} color="#F44336" />
          <Text style={styles.oldText}>Out of date</Text>
          <TouchableOpacity onPress={handleSync} disabled={isLoading}>
            <Text style={styles.syncNowText}>Sync now</Text>
          </TouchableOpacity>
        </>
      );
      break;
    case 'never':
      content = (
        <>
          <Ionicons name="cloud-offline" size={16} color="#F44336" />
          <Text style={styles.neverText}>Never synced</Text>
          <TouchableOpacity onPress={handleSync} disabled={isLoading}>
            <Text style={styles.syncNowText}>Sync now</Text>
          </TouchableOpacity>
        </>
      );
      break;
    case 'syncing':
      content = (
        <>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.syncingText}>Syncing...</Text>
        </>
      );
      break;
    case 'error':
      content = (
        <>
          <Ionicons name="alert-circle" size={16} color="#F44336" />
          <Text style={styles.errorText}>Sync failed</Text>
          <TouchableOpacity onPress={handleSync} disabled={isLoading}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </>
      );
      break;
    default:
      content = (
        <>
          <Ionicons name="cloud-offline" size={16} color="#9E9E9E" />
          <Text style={styles.unknownText}>Connect to sync</Text>
        </>
      );
  }

  return (
    <View style={[styles.container, style]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  syncedText: { color: '#4CAF50', marginLeft: 6, fontWeight: '500' },
  staleText: { color: '#FFA000', marginLeft: 6, fontWeight: '500' },
  oldText: { color: '#F44336', marginLeft: 6, fontWeight: '500' },
  neverText: { color: '#F44336', marginLeft: 6, fontWeight: '500' },
  syncingText: { color: '#2196F3', marginLeft: 6, fontWeight: '500' },
  errorText: { color: '#F44336', marginLeft: 6, fontWeight: '500' },
  unknownText: { color: '#9E9E9E', marginLeft: 6, fontWeight: '500' },
  timeText: { color: '#757575', marginLeft: 6, fontSize: 12 },
  syncNowText: { color: '#2196F3', marginLeft: 6, fontWeight: '500' },
  retryText: { color: '#2196F3', marginLeft: 6, fontWeight: '500' },
});

export default CaregiverSyncIndicator; 