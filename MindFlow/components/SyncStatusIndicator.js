import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAllUserData } from '../services/ServerSyncService';
import { useUser } from '../UserContext';

const SyncStatusIndicator = ({ style }) => {
  const { currentUser } = useUser();
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('unknown'); // unknown, syncing, success, error
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load last sync time when component mounts
    loadLastSyncTime();
  }, [currentUser]);

  const loadLastSyncTime = async () => {
    try {
      if (!currentUser || !currentUser.email) {
        return;
      }

      const userEmail = currentUser.email.toLowerCase().trim();
      const lastSyncKey = `lastServerSync_${userEmail}`;
      const syncTimeStr = await AsyncStorage.getItem(lastSyncKey);
      
      if (syncTimeStr) {
        setLastSyncTime(new Date(syncTimeStr));
        setSyncStatus('success');
      } else {
        setLastSyncTime(null);
        setSyncStatus('unknown');
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
      setSyncStatus('error');
    }
  };

  const formatSyncTime = () => {
    if (!lastSyncTime) {
      return 'Never synced';
    }

    // Get current time
    const now = new Date();
    const diffMs = now - lastSyncTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return lastSyncTime.toLocaleDateString();
    }
  };

  const handleSync = async () => {
    if (isSyncing || !currentUser || !currentUser.email) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');

      const userEmail = currentUser.email.toLowerCase().trim();
      const result = await syncAllUserData(userEmail);

      if (result.success) {
        await loadLastSyncTime();
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine icon based on sync status
  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <ActivityIndicator size="small" color="#005BBB" />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />;
      case 'error':
        return <Ionicons name="alert-circle" size={18} color="#F44336" />;
      case 'unknown':
      default:
        return <Ionicons name="cloud-offline" size={18} color="#9E9E9E" />;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handleSync}
      disabled={isSyncing}
    >
      <View style={styles.iconContainer}>
        {getStatusIcon()}
      </View>
      <Text style={styles.syncText}>
        {syncStatus === 'syncing' ? 'Syncing...' : `Last sync: ${formatSyncTime()}`}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 10,
  },
  iconContainer: {
    marginRight: 8,
  },
  syncText: {
    fontSize: 12,
    color: '#757575',
  }
});

export default SyncStatusIndicator; 