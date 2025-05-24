import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCaregiver } from '../CaregiverContext'; // Add this import

// Create the context
export const ReminderContext = createContext();

// Create a provider component
export const ReminderProvider = ({ children }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activePatient, isCaregiverMode, userEmail } = useCaregiver() || {}; // Get the active patient and caregiver mode

  // Process recurring reminders to ensure they continue daily
  const processDailyRecurringReminders = (remindersList) => {
    if (!Array.isArray(remindersList)) return remindersList;
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];
    const processedReminders = [...remindersList];
    
    // Look for completed daily reminders and create the next instance
    remindersList.forEach(reminder => {
      // Only process daily recurring reminders that are completed
      if (reminder.recurrence === 'daily' && (reminder.isCompleted || reminder.completed)) {
        // Check if we already have a future instance of this reminder
        const hasFutureInstance = remindersList.some(r => 
          r.recurrence === 'daily' && 
          r.title === reminder.title && 
          r.time === reminder.time && 
          r.date > today && 
          !r.isCompleted && 
          !r.completed
        );
        
        // If no future instance exists, create one for tomorrow
        if (!hasFutureInstance) {
          const nextInstance = {
            ...reminder,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Unique ID
            date: tomorrow,
            isCompleted: false,
            completed: false,
            // Inherit the persistence flag from the parent reminder
            isPersistent: reminder.isPersistent === undefined ? true : reminder.isPersistent,
            // Keep parent relationship to track recurring series
            parentReminderID: reminder.parentReminderID || reminder.id
          };
          
          processedReminders.push(nextInstance);
          console.log(`Created next day instance for daily reminder: ${reminder.title}`);
        }
      }
    });
    
    return processedReminders;
  };

  // Load reminders from storage when component mounts or active patient changes
  useEffect(() => {
    const loadReminders = async () => {
      try {
        setLoading(true);
        
        // If we have an active patient, load reminders specific to that patient
        if (activePatient?.email) {
          const patientEmail = activePatient.email.toLowerCase().trim();
          const patientReminderKey = `reminders_${patientEmail}`;
          const storedReminders = await AsyncStorage.getItem(patientReminderKey);
          
          if (storedReminders) {
            const parsedReminders = JSON.parse(storedReminders);
            let reminderArray = Array.isArray(parsedReminders) ? parsedReminders : [];
            
            // Process daily recurring reminders to ensure continuity
            reminderArray = processDailyRecurringReminders(reminderArray);
            
            setReminders(reminderArray);
            console.log(`Loaded ${reminderArray.length} reminders for active patient: ${patientEmail}`);
          } else {
            // No reminders found for this patient
            setReminders([]);
            console.log(`No reminders found for active patient: ${patientEmail}`);
          }
        } else {
          // No active patient, set empty reminders array
          setReminders([]);
          console.log('No active patient selected, not loading any reminders');
        }
      } catch (error) {
        console.error('Error loading reminders:', error);
        setReminders([]);
      } finally {
        setLoading(false);
      }
    };

    loadReminders();
  }, [activePatient]); // Re-load reminders when active patient changes

  // Save reminders to storage whenever they change
  useEffect(() => {
    const saveReminders = async () => {
      try {
        // Only save if we have an active patient
        if (activePatient?.email && !loading) {
          const patientEmail = activePatient.email.toLowerCase().trim();
          const patientReminderKey = `reminders_${patientEmail}`;
          await AsyncStorage.setItem(patientReminderKey, JSON.stringify(reminders));
          console.log(`Saved ${reminders.length} reminders for active patient: ${patientEmail}`);
        }
      } catch (error) {
        console.error('Error saving reminders:', error);
      }
    };

    if (!loading && activePatient?.email) {
      saveReminders();
    }
  }, [reminders, loading, activePatient]);

  // Process daily reminders for the current day
  useEffect(() => {
    // Skip if we're still loading or don't have an active patient
    if (loading || !activePatient?.email || !Array.isArray(reminders)) {
      return;
    }
    
    // Create a function to ensure daily reminders exist for today
    const ensureDailyRemindersForToday = () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];
      let updatedReminders = [...reminders];
      let changesNeeded = false;
      
      // Find daily reminders and check if they have instances for today
      reminders.forEach(reminder => {
        // Only process daily recurring reminders
        if (reminder.recurrence === 'daily') {
          // Check if this reminder has an instance for today
          const hasTodayInstance = reminders.some(r => 
            r.recurrence === 'daily' && 
            r.title === reminder.title && 
            r.time === reminder.time && 
            r.date === today
          );
          
          // If no instance for today exists, create one
          if (!hasTodayInstance) {
            const todayInstance = {
              ...reminder,
              id: Date.now().toString() + Math.random().toString(36).substring(2, 10), // Unique ID
              date: today,
              isCompleted: false,
              completed: false,
              // Set persistence flag to ensure it stays after completion
              isPersistent: reminder.isPersistent === undefined ? true : reminder.isPersistent,
              // Keep parent relationship to track recurring series
              parentReminderID: reminder.parentReminderID || reminder.id
            };
            
            updatedReminders.push(todayInstance);
            changesNeeded = true;
            console.log(`Created today's instance for daily reminder: ${reminder.title}`);
          }
        }
      });
      
      // Only update state if changes were made
      if (changesNeeded) {
        setReminders(updatedReminders);
        console.log('Updated reminders with today\'s daily reminders');
      }
    };
    
    // Run once when reminders are loaded
    ensureDailyRemindersForToday();
    
    // Set up a check at midnight to create next day's reminders
    const checkForNewDay = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const timeUntilMidnight = tomorrow - now;
      
      // Schedule the check for just after midnight
      const midnightTimeout = setTimeout(() => {
        ensureDailyRemindersForToday();
        // After running once, set it up again for the next day
        checkForNewDay();
      }, timeUntilMidnight);
      
      // Cleanup function
      return () => clearTimeout(midnightTimeout);
    };
    
    // Start the midnight check cycle
    const cleanup = checkForNewDay();
    return cleanup;
  }, [reminders, loading, activePatient]);

  // Add a reminder
  const addReminder = useCallback(async (reminder) => {
    try {
      console.log("Adding reminder with context...");
      
      // Ensure we have an active patient if in caregiver mode
      if (isCaregiverMode && !activePatient?.email) {
        console.error('Cannot add reminder: No active patient selected');
        return { success: false, message: 'No active patient selected. Please select a patient first.' };
      }
      
      const now = new Date();
      const reminderToAdd = {
        ...reminder,
        id: reminder.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        completed: reminder.completed || false,
        dateAdded: reminder.dateAdded || now.toISOString(),
        lastUpdated: now.toISOString(),
        // Set isPersistent to true by default if not specified
        isPersistent: reminder.isPersistent === undefined ? true : reminder.isPersistent
      };
      
      // Add patient attribution if in caregiver mode
      if (isCaregiverMode && activePatient?.email) {
        console.log(`Adding caregiver attribution to reminder for patient: ${activePatient.email}`);
        reminderToAdd.forPatient = activePatient.email.toLowerCase().trim();
        reminderToAdd.addedByCaregiver = true;
        reminderToAdd.caregiverEmail = userEmail || '';
        
        // Store reminder time in MS for comparison
        if (reminderToAdd.time) {
          try {
            // This is just for improved sorting/filtering
            const timeString = reminderToAdd.time;
            const [hours, minutes] = timeString.split(':').map(Number);
            reminderToAdd.timeInMs = (hours * 60 + minutes) * 60 * 1000;
          } catch (timeErr) {
            console.log('Error parsing time to MS:', timeErr);
            // Not critical, continue without this field
          }
        }
      }
      
      console.log("Adding reminder:", reminderToAdd);
      setReminders(prev => [...(Array.isArray(prev) ? prev : []), reminderToAdd]);
      return { success: true, reminder: reminderToAdd };
    } catch (error) {
      console.error('Error adding reminder:', error);
      return { success: false, message: error.message };
    }
  }, [isCaregiverMode, activePatient, userEmail]);

  // Update an existing reminder
  const updateReminder = (id, updatedReminder) => {
    try {
      // Check if we have an active patient
      if (!activePatient?.email) {
        console.error('Cannot update reminder: No active patient selected');
        return false;
      }
      
      // Ensure reminders is an array before operating on it
      if (!Array.isArray(reminders)) {
        console.error('Cannot update reminder: reminders is not an array');
        return false;
      }
      
      setReminders(
        reminders.map((reminder) =>
          reminder.id === id ? { ...updatedReminder, id, forPatient: activePatient.email.toLowerCase().trim() } : reminder
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating reminder:', error);
      return false;
    }
  };

  // Delete a reminder
  const deleteReminder = (id) => {
    try {
      // Check if we have an active patient
      if (!activePatient?.email) {
        console.error('Cannot delete reminder: No active patient selected');
        return false;
      }
      
      // Ensure reminders is an array before operating on it
      if (!Array.isArray(reminders)) {
        console.error('Cannot delete reminder: reminders is not an array');
        return false;
      }
      
      setReminders(reminders.filter((reminder) => reminder.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting reminder:', error);
      return false;
    }
  };
  
  // Remove a reminder (alias for deleteReminder, used in CaregiverHomeScreen)
  const removeReminder = (id) => {
    return deleteReminder(id);
  };
  
  // Complete a reminder
  const completeReminder = (id) => {
    try {
      // Check if we have an active patient
      if (!activePatient?.email) {
        console.error('Cannot complete reminder: No active patient selected');
        return false;
      }
      
      // Ensure reminders is an array before operating on it
      if (!Array.isArray(reminders)) {
        console.error('Cannot complete reminder: reminders is not an array');
        return false;
      }
      
      // First mark the reminder as completed with completion timestamp
      const now = new Date();
      const updatedReminders = reminders.map((reminder) =>
        reminder.id === id ? { 
          ...reminder, 
          isCompleted: true, 
          completed: true,
          completedAt: now.toISOString(),
          completedBy: 'caregiver'
        } : reminder
      );
      
      // Then process daily recurring reminders to create the next day's instance
      const processedReminders = processDailyRecurringReminders(updatedReminders);
      
      // Update state with processed reminders
      setReminders(processedReminders);
      return true;
    } catch (error) {
      console.error('Error completing reminder:', error);
      return false;
    }
  };

  return (
    <ReminderContext.Provider
      value={{
        reminders,
        loading,
        addReminder,
        updateReminder,
        deleteReminder,
        removeReminder,
        completeReminder
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
};

// Custom hook to use the reminder context
export const useReminders = () => {
  try {
    const context = useContext(ReminderContext);
    if (!context) {
      console.error('useReminders must be used within a ReminderProvider');
      // Return fallback values instead of throwing an error
      return { 
        reminders: [], 
        loading: false,
        addReminder: () => { 
          console.error('ReminderContext not available');
          return false; 
        },
        updateReminder: () => { 
          console.error('ReminderContext not available');
          return false; 
        },
        deleteReminder: () => { 
          console.error('ReminderContext not available');
          return false; 
        },
        removeReminder: () => { 
          console.error('ReminderContext not available');
          return false; 
        },
        completeReminder: () => { 
          console.error('ReminderContext not available');
          return false; 
        }
      };
    }
    return context;
  } catch (error) {
    console.error('Error using Reminders context:', error);
    // Return fallback values
    return { 
      reminders: [], 
      loading: false,
      addReminder: () => false,
      updateReminder: () => false,
      deleteReminder: () => false,
      removeReminder: () => false,
      completeReminder: () => false
    };
  }
};