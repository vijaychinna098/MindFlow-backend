import React, { useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReminderContext } from "../../context/ReminderContext";
import { useUser } from "../../UserContext";
import { Ionicons } from "@expo/vector-icons";
import { useFontSize } from "../user/FontSizeContext"; // Updated import path
import { syncUserReminders } from '../../services/ServerSyncService';

const parseTime = (timeStr) => {
  try {
    if (!timeStr) return 0; // Handle null or undefined
    
    // Check if it's in 24-hour format (HH:MM)
    if (timeStr.includes(':') && !timeStr.includes(' ')) {
      const [hourStr, minuteStr] = timeStr.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      
      if (isNaN(hour) || isNaN(minute)) return 0;
      return hour * 60 + minute;
    }
    
    // Handle AM/PM format
    const [time, period] = (timeStr || "").split(" ");
    if (!time || !period) {
      // Try to extract from "9:30AM" format (no space)
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)/i);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        
        return hour * 60 + minute;
      }
      
      return 0; // Couldn't parse
    }
    
    const [hourStr, minuteStr] = (time || "").split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isNaN(hour) || isNaN(minute)) return 0;
    
    if (period && period.toUpperCase() === "PM" && hour !== 12) {
      hour += 12;
    }
    if (period && period.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    }
    
    return hour * 60 + minute;
  } catch (error) {
    console.error("Error parsing time:", error);
    return 0; // Default value for sorting
  }
};

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const RemindersScreen = () => {
  const { currentUser } = useUser();
  const { fontSize } = useFontSize();
  
  const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
  const storageKey = userEmail ? `reminders_${userEmail}` : 'reminders';
  
  // Fix: Use state to manage reminders locally in this component
  const [userReminders, setUserReminders] = useState([]);
  // Still get context methods for operations
  const { addReminder = () => false, removeReminder = () => false, completeReminder = () => false } = useContext(ReminderContext) || {};
  
  const [connectedCaregiverEmail, setConnectedCaregiverEmail] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // New state variables to track daily completion count and last tracked date
  const [dailyCompletedCount, setDailyCompletedCount] = useState(0);
  const [lastTrackedDate, setLastTrackedDate] = useState('');

  // Check for connected caregiver
  useEffect(() => {
    const checkCaregiverConnection = async () => {
      if (!userEmail) return;
      
      try {
        // Check if this user is connected to a caregiver
        const mappingKey = `reminder_mapping_${userEmail}`;
        const caregiverEmail = await AsyncStorage.getItem(mappingKey);
        
        if (caregiverEmail) {
          console.log(`User is connected to caregiver: ${caregiverEmail}`);
          setConnectedCaregiverEmail(caregiverEmail);
          
          // Check if caregiver has more recent reminders
          await checkCaregiverReminders(caregiverEmail);
        }
      } catch (error) {
        console.error("Failed to check caregiver connection:", error);
      }
    };
    
    checkCaregiverConnection();
  }, [userEmail]);

  // Load reminders for current user
  useEffect(() => {
    const loadReminders = async () => {
      try {
        const storedReminders = await AsyncStorage.getItem(storageKey);
        if (!storedReminders) {
          // No reminders found
          return;
        }
        
        try {
          const parsedReminders = JSON.parse(storedReminders);
          if (!Array.isArray(parsedReminders)) {
            console.error("Stored reminders is not an array");
            return;
          }
          
          // Filter out invalid reminders and ensure they belong to this user
          const validReminders = parsedReminders.filter(reminder => 
            reminder && 
            reminder.id && 
            reminder.title && 
            (!reminder.forPatient || reminder.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim())
          );
          
          // Update the local state with filtered reminders
          setUserReminders(validReminders);
          
          if (validReminders.length > 0) {
            setLastSyncTime(new Date().toLocaleString());
            console.log("Loaded user-specific reminders:", validReminders.length);
          }
        } catch (parseError) {
          console.error("Failed to parse stored reminders:", parseError);
        }
        
        // Load completed tasks
        const storedCompletedTasks = await AsyncStorage.getItem(`completedTasks_${userEmail}`);
        if (storedCompletedTasks) {
          try {
            const parsedTasks = JSON.parse(storedCompletedTasks);
            if (Array.isArray(parsedTasks)) {
              setCompletedTasks(parsedTasks);
            }
          } catch (parseError) {
            console.error("Failed to parse completed tasks:", parseError);
          }
        }
      } catch (error) {
        console.error("Failed to load reminders:", error);
      }
    };
    
    if (userEmail) {
      loadReminders();
    }
  }, [storageKey, userEmail]);

  // Save completed tasks when they change
  useEffect(() => {
    const saveCompletedTasks = async () => {
      if (!userEmail) return;
      
      try {
        await AsyncStorage.setItem(`completedTasks_${userEmail}`, JSON.stringify(completedTasks));
      } catch (error) {
        console.error("Failed to save completed tasks:", error);
      }
    };
    
    if (completedTasks.length > 0) {
      saveCompletedTasks();
    }
  }, [completedTasks, userEmail]);

  // Check for date change and reset the counter if needed
  useEffect(() => {
    const checkDateAndResetCounter = async () => {
      if (!userEmail) return;
      
      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Load the last tracked date from storage
        const storedDate = await AsyncStorage.getItem(`lastCompletedDate_${userEmail}`);
        const storedCount = await AsyncStorage.getItem(`dailyCompletedCount_${userEmail}`);
        
        // Set the last tracked date state
        setLastTrackedDate(storedDate || '');
        
        // Set the daily completed count state (default to 0)
        setDailyCompletedCount(storedCount ? parseInt(storedCount, 10) : 0);
        
        // If today is different from the stored date, reset the counter
        if (storedDate !== today) {
          console.log(`New day detected (${today} vs ${storedDate}). Resetting daily counter.`);
          setDailyCompletedCount(0);
          await AsyncStorage.setItem(`dailyCompletedCount_${userEmail}`, '0');
          await AsyncStorage.setItem(`lastCompletedDate_${userEmail}`, today);
        }
      } catch (error) {
        console.error("Failed to check date and reset counter:", error);
      }
    };
    
    checkDateAndResetCounter();
  }, [userEmail]);

  // Save daily completed count when it changes
  useEffect(() => {
    const saveDailyCount = async () => {
      if (!userEmail) return;
      
      try {
        await AsyncStorage.setItem(`dailyCompletedCount_${userEmail}`, dailyCompletedCount.toString());
      } catch (error) {
        console.error("Failed to save daily completed count:", error);
      }
    };
    
    saveDailyCount();
  }, [dailyCompletedCount, userEmail]);

  // Function to check if caregiver has set reminders for this patient
  const checkCaregiverReminders = async (caregiverEmail) => {
    if (!caregiverEmail || !userEmail) return;
    
    try {
      // Check caregiver's reminders
      const caregiverKey = `reminders_${caregiverEmail}`;
      const caregiverRemindersData = await AsyncStorage.getItem(caregiverKey);
      
      if (caregiverRemindersData) {
        try {
          const allCaregiverReminders = JSON.parse(caregiverRemindersData);
          if (!Array.isArray(allCaregiverReminders)) {
            console.error("Caregiver reminders is not an array");
            return;
          }
          
          // Find reminders assigned to this user
          const forUserReminders = allCaregiverReminders.filter(reminder => 
            reminder && 
            reminder.forPatient && 
            reminder.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim()
          );
          
          console.log(`Found ${forUserReminders.length} reminders from caregiver for this user`);
          
          // Update our reminders from caregiver's list
          if (forUserReminders.length > 0) {
            // Save to user's own storage
            await AsyncStorage.setItem(storageKey, JSON.stringify(forUserReminders));
            
            // Update the local state
            setUserReminders(forUserReminders);
            
            setLastSyncTime(new Date().toLocaleString());
            console.log("Synced reminders from caregiver");
          }
        } catch (parseError) {
          console.error("Failed to parse caregiver reminders:", parseError);
        }
      }
    } catch (error) {
      console.error("Failed to fetch caregiver reminders:", error);
    }
  };

  // Handle task completion
  const handleTaskCompletion = (task) => {
    if (!task || !task.id) {
      console.error("Invalid task");
      return;
    }
    
    try {
      const currentTime = getCurrentMinutes();
      const taskTime = parseTime(task.time);
      
      // Check if task is being completed before scheduled time
      if (currentTime < taskTime) {
        const minutesRemaining = taskTime - currentTime;
        // Convert minutes to hours and minutes for display
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const minsRemaining = minutesRemaining % 60;
        let timeMessage = "";
        
        if (hoursRemaining > 0) {
          timeMessage = `${hoursRemaining} ${hoursRemaining > 1 ? 'hours' : 'hour'} and ${minsRemaining} ${minsRemaining !== 1 ? 'minutes' : 'minute'}`;
        } else {
          timeMessage = `${minsRemaining} ${minsRemaining !== 1 ? 'minutes' : 'minute'}`;
        }
        
        Alert.alert(
          'Early Completion',
          `Task scheduled for ${task.time}. You still have ${timeMessage} to complete it. Mark as completed anyway?`,
          [
            { text: 'No', style: "cancel" },
            { 
              text: 'Yes, Complete Now', 
              onPress: () => markTaskAsCompleted(task.id) 
            }
          ]
        );
      } else {
        // Task is on time or late
        Alert.alert(
          'Complete Task',
          `Mark task as completed: "${task.title}"?`,
          [
            { text: 'Cancel', style: "cancel" },
            { 
              text: 'Complete', 
              onPress: () => markTaskAsCompleted(task.id) 
            }
          ]
        );
      }
    } catch (error) {
      console.error("Error in handleTaskCompletion:", error);
      // Fall back to simple completion
      markTaskAsCompleted(task.id);
    }
  };
  
  const markTaskAsCompleted = async (taskId) => {
    if (!taskId) return;
    
    setCompletedTasks(prev => {
      // Check if task is already marked as completed
      if (prev.includes(taskId.toString())) {
        return prev;
      }
      
      // Increment the daily completed count
      setDailyCompletedCount(prevCount => prevCount + 1);
      
      // Update today's date as the last tracked date
      const today = new Date().toISOString().split('T')[0];
      setLastTrackedDate(today);
      AsyncStorage.setItem(`lastCompletedDate_${userEmail}`, today);
      
      return [...prev, taskId.toString()];
    });
    
    // Sync updated status with server
    try {
      if (userEmail) {
        console.log('Syncing reminder completion with server...');
        await syncUserReminders(userEmail);
      }
    } catch (syncError) {
      console.error('Error syncing reminder completion with server:', syncError);
      // Continue even if sync fails
    }
    
    // Optional: Display a congratulatory message
    Alert.alert(
      'Task Completed',
      `Great job completing your task! You've completed ${dailyCompletedCount + 1} ${(dailyCompletedCount + 1) === 1 ? 'reminder' : 'reminders'} today.`,
      [{ text: 'OK' }]
    );
  };

  // Filter tasks based on completion status - add null checks
  const validReminders = Array.isArray(userReminders) ? userReminders.filter(r => r && r.id) : [];
  
  const activeReminders = validReminders.filter(reminder => 
    !completedTasks.includes(reminder.id.toString())
  );
  
  const completedReminders = validReminders.filter(reminder => 
    completedTasks.includes(reminder.id.toString())
  );
  
  // Sort by time
  const sortedActiveReminders = [...activeReminders].sort(
    (a, b) => parseTime(a.time) - parseTime(b.time)
  );
  
  const sortedCompletedReminders = [...completedReminders].sort(
    (a, b) => parseTime(a.time) - parseTime(b.time)
  );
  
  // Determine which reminders to display
  const displayedReminders = showCompleted ? sortedCompletedReminders : sortedActiveReminders;

  const renderReminderItem = ({ item }) => {
    const isCompleted = completedTasks.includes(item.id.toString());
    
    return (
      <TouchableOpacity 
        onPress={() => !isCompleted && handleTaskCompletion(item)}
        disabled={isCompleted}
      >
        <View style={[
          styles.reminderItem,
          isCompleted && styles.completedReminderItem
        ]}>
          <View style={styles.reminderContent}>
            <Text style={[
              styles.reminderTime,
              isCompleted && styles.completedReminderText,
              { fontSize: fontSize - 2 }
            ]}>
              {item.time}
            </Text>
            <Text style={[
              styles.reminderText,
              isCompleted && styles.completedReminderText,
              { fontSize: fontSize }
            ]}>
              {item.title}
            </Text>
          </View>
          {isCompleted && (
            <Text style={[styles.completedIndicator, { fontSize: fontSize - 4 }]}>
              Completed
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: fontSize + 2 }]}>Reminders</Text>
      
      {connectedCaregiverEmail && (
        <View style={styles.caregiverInfoBox}>
          <Ionicons name="sync" size={20} color="#005BBB" />
          <Text style={[styles.caregiverInfoText, { fontSize: fontSize - 2 }]}>
            Reminders are managed by your caregiver
            {lastSyncTime ? ` (Last updated: ${lastSyncTime})` : ''}
          </Text>
        </View>
      )}
      
      <View style={styles.statsContainer}>
        <Text style={[styles.statsText, { fontSize: fontSize - 2 }]}>
          Today's completed: {dailyCompletedCount}
        </Text>
      </View>
      
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[
            styles.filterButton,
            !showCompleted && styles.activeFilterButton
          ]}
          onPress={() => setShowCompleted(false)}
        >
          <Text style={[
            styles.filterText,
            !showCompleted && styles.activeFilterText,
            { fontSize: fontSize - 2 }
          ]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.filterButton,
            showCompleted && styles.activeFilterButton
          ]}
          onPress={() => setShowCompleted(true)}
        >
          <Text style={[
            styles.filterText,
            showCompleted && styles.activeFilterText,
            { fontSize: fontSize - 2 }
          ]}>
            Completed ({completedReminders.length})
          </Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={displayedReminders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReminderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { fontSize: fontSize }]}>
              {showCompleted 
                ? 'No completed tasks yet'
                : 'No active reminders'
              }
            </Text>
            <Text style={[styles.infoText, { fontSize: fontSize - 2 }]}>
              {showCompleted
                ? 'Complete tasks to see them here'
                : 'Ask your caregiver to add reminders for you'
              }
            </Text>
          </View>
        }
      />
      
      <View style={styles.infoBox}>
        <Text style={[styles.infoBoxText, { fontSize: fontSize - 2 }]}>
          Only caregivers can add or modify reminders
        </Text>
        <Text style={[styles.infoBoxText, { fontSize: fontSize - 2 }]}>
          You can mark reminders as complete when you finish them
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#212529",
  },
  caregiverInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9f5ff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  caregiverInfoText: {
    marginLeft: 10,
    color: "#005BBB",
    flex: 1,
  },
  reminderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 1,
  },
  completedReminderItem: {
    backgroundColor: "#f1f8e9",
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  reminderContent: {
    flex: 1,
  },
  reminderTime: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#005BBB",
    marginBottom: 5,
  },
  reminderText: {
    fontSize: 16,
    color: "#212529",
  },
  completedReminderText: {
    color: "#689F38",
    textDecorationLine: "line-through",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6c757d",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#e9f5ff",
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  infoBoxText: {
    color: "#005BBB",
    marginBottom: 5,
    textAlign: "center",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: 15,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#e9ecef",
  },
  activeFilterButton: {
    borderBottomColor: "#005BBB",
  },
  filterText: {
    color: "#6c757d",
    fontWeight: "bold",
  },
  activeFilterText: {
    color: "#005BBB",
  },
  completedIndicator: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "bold",
    fontStyle: "italic"
  },
  statsContainer: {
    backgroundColor: "#e2f1f8",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: "center"
  },
  statsText: {
    color: "#0077CC",
    fontWeight: "bold"
  },
});

export default RemindersScreen;