import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useUser } from '../../UserContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../config';
import { useFontSize, FontSizeProvider } from '../user/FontSizeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Create a component that safely uses fontSize
const NotificationScreenContent = ({ navigation }) => {
  const { currentUser } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Use fontSize with a default fallback if the context is not available
  const fontSizeContext = useFontSize();
  const fontSize = fontSizeContext?.fontSize || 16; // Default font size if context not available

  // Fetch notifications from local storage (FCM)
  const fetchNotifications = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      
      if (!currentUser || !currentUser.email) {
        console.log('No current user found, cannot fetch notifications');
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const userEmail = currentUser.email.toLowerCase().trim();
      
      // Get user-specific notifications using the user-specific key
      const notificationKey = `localNotifications_${userEmail}`;
      const storedLocalNotifications = await AsyncStorage.getItem(notificationKey);
      
      if (storedLocalNotifications) {
        const parsedNotifications = JSON.parse(storedLocalNotifications);
        
        // Transform to a consistent format
        const formattedNotifications = parsedNotifications.map(notification => ({
          _id: notification.id,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          read: notification.read,
          createdAt: notification.receivedAt || notification.timestamp,
          type: notification.source === 'fcm' ? 'firebase' : 'system',
          userEmail: notification.userEmail || userEmail, // Include user email for reference
        }));
        
        // Sort by date (newest first)
        formattedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setNotifications(formattedNotifications);
        console.log(`Loaded ${formattedNotifications.length} notifications for user: ${userEmail}`);
      } else {
        console.log(`No notifications found for user: ${userEmail}`);
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notification) => {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user, cannot mark notification as read');
        return;
      }
      
      const userEmail = currentUser.email.toLowerCase().trim();
      const notificationKey = `localNotifications_${userEmail}`;
      
      // Get user-specific notifications
      const storedNotifications = await AsyncStorage.getItem(notificationKey);
      if (!storedNotifications) return;
      
      const localNotifications = JSON.parse(storedNotifications);
      const updatedNotifications = localNotifications.map(item => 
        item.id === notification._id ? { ...item, read: true } : item
      );
      
      // Update the user-specific notifications
      await AsyncStorage.setItem(notificationKey, JSON.stringify(updatedNotifications));
      
      // Update UI
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notification._id ? { ...notif, read: true } : notif
        )
      );
      
      console.log(`Marked notification ${notification._id} as read for user ${userEmail}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    // Mark as read when pressed
    if (!notification.read) {
      markAsRead(notification);
    }
    
    // Navigate based on notification type
    if (notification.data && notification.data.screen) {
      navigation.navigate(notification.data.screen, notification.data.params || {});
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const notifTime = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(notifTime.getTime())) return 'Unknown time';
    
    const diffInSeconds = Math.floor((now - notifTime) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    // If older than a week, return the date
    return notifTime.toLocaleDateString();
  };

  useEffect(() => {
    fetchNotifications();
    
    // Listen for focus events to refresh notifications
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNotifications();
    });
    
    return unsubscribe;
  }, [navigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: fontSize * 1.4,
      fontWeight: 'bold',
      color: '#000000',
    },
    clearButton: {
      padding: 8,
    },
    clearButtonText: {
      color: '#4287f5',
      fontSize: fontSize * 0.9,
    },
    notificationItem: {
      backgroundColor: '#F5F5F5',
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      borderLeftWidth: 5,
      flexDirection: 'row',
    },
    unread: {
      borderLeftColor: '#4287f5',
    },
    read: {
      borderLeftColor: '#cccccc',
    },
    contentContainer: {
      flex: 1,
      marginLeft: 10,
    },
    title: {
      fontSize: fontSize * 1.1,
      fontWeight: 'bold',
      color: '#000000',
      marginBottom: 5,
    },
    body: {
      fontSize: fontSize,
      color: '#000000',
      marginBottom: 5,
    },
    timestamp: {
      fontSize: fontSize * 0.8,
      color: '#666666',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSize * 1.1,
      color: '#666666',
      textAlign: 'center',
      marginTop: 10,
    },
    icon: {
      marginTop: 3,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    typeTag: {
      fontSize: fontSize * 0.7,
      color: '#666666',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginTop: 4,
    }
  });

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, item.read ? styles.read : styles.unread]}
      onPress={() => handleNotificationPress(item)}
    >
      <Ionicons 
        name={item.read ? "notifications-outline" : "notifications"} 
        size={24} 
        color={item.read ? "#666666" : "#4287f5"}
        style={styles.icon}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.timestamp}>{getTimeAgo(item.createdAt)}</Text>
          <Text style={styles.typeTag}>{item.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const clearAllNotifications = async () => {
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
              if (!currentUser || !currentUser.email) {
                console.error('No current user, cannot clear notifications');
                return;
              }
              
              const userEmail = currentUser.email.toLowerCase().trim();
              const notificationKey = `localNotifications_${userEmail}`;
              
              // Clear only the current user's notifications
              await AsyncStorage.setItem(notificationKey, JSON.stringify([]));
              console.log(`Cleared all notifications for user: ${userEmail}`);
              
              // Refresh the list
              fetchNotifications();
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4287f5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearAllNotifications}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={60} color="#CCCCCC" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={item => item._id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={fetchNotifications} 
              colors={['#4287f5']}
            />
          }
        />
      )}
    </View>
  );
};

// Wrapper component that ensures FontSizeProvider is available
const NotificationScreen = (props) => {
  try {
    // First try to render with existing context
    return <NotificationScreenContent {...props} />;
  } catch (error) {
    // If it fails, wrap with a FontSizeProvider
    console.log('Wrapping NotificationScreen with FontSizeProvider:', error.message);
    return (
      <FontSizeProvider>
        <NotificationScreenContent {...props} />
      </FontSizeProvider>
    );
  }
};

export default NotificationScreen;