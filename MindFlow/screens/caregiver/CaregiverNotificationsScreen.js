import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCaregiver } from '../../CaregiverContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFontSize } from './CaregiverFontSizeContext';

const CaregiverNotificationsScreen = () => {
  const navigation = useNavigation();
  const { caregiver } = useCaregiver();
  const { fontSize } = useFontSize();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    if (!caregiver || !caregiver.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const caregiverEmail = caregiver.email.toLowerCase().trim();
      const taskNotificationKey = `taskCompletions_${caregiverEmail}`;
      const caregiverNotificationKey = `caregiverNotifications_${caregiverEmail}`;
      
      let allNotifications = [];
      
      const storedTaskNotifications = await AsyncStorage.getItem(taskNotificationKey);
      if (storedTaskNotifications) {
        const parsedNotifications = JSON.parse(storedTaskNotifications);
        if (Array.isArray(parsedNotifications)) {
          const updatedNotifications = parsedNotifications.map(notification => ({
            ...notification,
            read: true
          }));
          await AsyncStorage.setItem(taskNotificationKey, JSON.stringify(updatedNotifications));
          allNotifications = [...allNotifications, ...updatedNotifications];
        }
      }
      
      const storedCaregiverNotifications = await AsyncStorage.getItem(caregiverNotificationKey);
      if (storedCaregiverNotifications) {
        const parsedNotifications = JSON.parse(storedCaregiverNotifications);
        if (Array.isArray(parsedNotifications)) {
          const updatedNotifications = parsedNotifications.map(notification => ({
            ...notification,
            read: true
          }));
          await AsyncStorage.setItem(caregiverNotificationKey, JSON.stringify(updatedNotifications));
          allNotifications = [...allNotifications, ...updatedNotifications];
        }
      }
      
      if (allNotifications.length > 0) {
        allNotifications.sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        setNotifications(allNotifications);
      } else {
        setNotifications([]);
      }
      
      const unreadCountKey = `unreadNotifications_${caregiverEmail}`;
      await AsyncStorage.setItem(unreadCountKey, '0');
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNotifications();
    });
    
    return unsubscribe;
  }, [navigation, caregiver]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const clearAllNotifications = async () => {
    if (!caregiver || !caregiver.email) return;
    
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const caregiverEmail = caregiver.email.toLowerCase().trim();
              const taskNotificationKey = `taskCompletions_${caregiverEmail}`;
              const caregiverNotificationKey = `caregiverNotifications_${caregiverEmail}`;
              
              await AsyncStorage.setItem(taskNotificationKey, JSON.stringify([]));
              await AsyncStorage.setItem(caregiverNotificationKey, JSON.stringify([]));
              setNotifications([]);
              
              const unreadCountKey = `unreadNotifications_${caregiverEmail}`;
              await AsyncStorage.setItem(unreadCountKey, '0');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
        return `${diffMins}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown time';
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!caregiver || !caregiver.email || !notificationId) return;
    
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const caregiverEmail = caregiver.email.toLowerCase().trim();
              const taskNotificationKey = `taskCompletions_${caregiverEmail}`;
              const caregiverNotificationKey = `caregiverNotifications_${caregiverEmail}`;
              
              const caregiverNotifications = await AsyncStorage.getItem(caregiverNotificationKey);
              if (caregiverNotifications) {
                const parsedNotifications = JSON.parse(caregiverNotifications);
                if (Array.isArray(parsedNotifications)) {
                  const filteredNotifications = parsedNotifications.filter(
                    notification => notification.id !== notificationId
                  );
                  await AsyncStorage.setItem(caregiverNotificationKey, JSON.stringify(filteredNotifications));
                }
              }
              
              const taskNotifications = await AsyncStorage.getItem(taskNotificationKey);
              if (taskNotifications) {
                const parsedNotifications = JSON.parse(taskNotifications);
                if (Array.isArray(parsedNotifications)) {
                  const filteredNotifications = parsedNotifications.filter(
                    notification => notification.id !== notificationId
                  );
                  await AsyncStorage.setItem(taskNotificationKey, JSON.stringify(filteredNotifications));
                }
              }
              
              setNotifications(prevNotifications => 
                prevNotifications.filter(notification => notification.id !== notificationId)
              );
            } catch (error) {
              console.error('Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification');
            }
          }
        }
      ]
    );
  };

  const renderNotificationItem = ({ item }) => {
    if (item.type === 'taskCompleted') {
      return (
        <View style={styles.notificationItem}>
          <View style={styles.notificationIcon}>
            <Ionicons name="checkmark-circle" size={30} color="#4CAF50" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>
              {item.patientName} completed: {item.taskTitle}
            </Text>
            <Text style={styles.notificationTime}>
              {item.taskTime && `Task was due at ${item.taskTime} • `}{formatTimestamp(item.timestamp)}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => deleteNotification(item.id)}
          >
            <Ionicons name="trash-outline" size={24} color="#D9534F" />
          </TouchableOpacity>
        </View>
      );
    } else if (item.type === 'location_alert') {
      return (
        <TouchableOpacity 
          style={[styles.notificationItem, { borderLeftWidth: 4, borderLeftColor: '#FF5252' }]}
          onPress={() => {
            if (item.data && item.data.patientEmail) {
              AsyncStorage.setItem('deepLinkPatientEmail', item.data.patientEmail)
                .then(() => {
                  navigation.navigate('CaregiverMap');
                  markNotificationAsRead(item.id);
                })
                .catch(error => console.error('Error storing patient email:', error));
            }
          }}
        >
          <View style={styles.notificationIcon}>
            <Ionicons name="warning" size={30} color="#FF5252" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, { color: '#D32F2F' }]}>
              {item.title}
            </Text>
            <Text style={styles.notificationMessage}>
              {item.message}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTimestamp(item.timestamp)} • Tap to view location
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              deleteNotification(item.id);
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#D9534F" />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    } else {
      return (
        <View style={styles.notificationItem}>
          <View style={styles.notificationIcon}>
            <Ionicons name="notifications" size={30} color="#005BBB" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>
              {item.title}
            </Text>
            {item.message && (
              <Text style={styles.notificationMessage}>
                {item.message}
              </Text>
            )}
            <Text style={styles.notificationTime}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => deleteNotification(item.id)}
          >
            <Ionicons name="trash-outline" size={24} color="#D9534F" />
          </TouchableOpacity>
        </View>
      );
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    if (!caregiver || !caregiver.email || !notificationId) return;
    
    try {
      const caregiverEmail = caregiver.email.toLowerCase().trim();
      const taskNotificationKey = `taskCompletions_${caregiverEmail}`;
      const caregiverNotificationKey = `caregiverNotifications_${caregiverEmail}`;
      
      const caregiverNotifications = await AsyncStorage.getItem(caregiverNotificationKey);
      if (caregiverNotifications) {
        const parsedNotifications = JSON.parse(caregiverNotifications);
        let updated = false;
        
        if (Array.isArray(parsedNotifications)) {
          for (let i = 0; i < parsedNotifications.length; i++) {
            if (parsedNotifications[i].id === notificationId) {
              parsedNotifications[i].read = true;
              updated = true;
              break;
            }
          }
          
          if (updated) {
            await AsyncStorage.setItem(caregiverNotificationKey, JSON.stringify(parsedNotifications));
            setNotifications(prevNotifications => 
              prevNotifications.map(notification => 
                notification.id === notificationId 
                  ? {...notification, read: true} 
                  : notification
              )
            );
          }
        }
      }
      
      const taskNotifications = await AsyncStorage.getItem(taskNotificationKey);
      if (taskNotifications) {
        const parsedNotifications = JSON.parse(taskNotifications);
        let updated = false;
        
        if (Array.isArray(parsedNotifications)) {
          for (let i = 0; i < parsedNotifications.length; i++) {
            if (parsedNotifications[i].id === notificationId) {
              parsedNotifications[i].read = true;
              updated = true;
              break;
            }
          }
          
          if (updated) {
            await AsyncStorage.setItem(taskNotificationKey, JSON.stringify(parsedNotifications));
            setNotifications(prevNotifications => 
              prevNotifications.map(notification => 
                notification.id === notificationId 
                  ? {...notification, read: true} 
                  : notification
              )
            );
          }
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: fontSize + 4 }]}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={clearAllNotifications}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#005BBB" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.notificationsList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#888" />
              <Text style={styles.emptyText}>No notifications</Text>
              <Text style={styles.emptySubtext}>
                You'll see notifications here including patient task completions and location alerts
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    elevation: 2,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  clearButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    color: '#D9534F',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationsList: {
    flexGrow: 1,
    paddingVertical: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 1,
  },
  notificationIcon: {
    marginRight: 15,
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    justifyContent: 'center',
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#555',
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default CaregiverNotificationsScreen;