import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReminders } from "../../context/ReminderContext";
import { useCaregiver } from "../../CaregiverContext";
import { useNavigation } from "@react-navigation/native";
import { useFontSize } from "./CaregiverFontSizeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { syncCaregiverReminders, syncAllCaregiverData } from "../../services/ServerSyncService";

// Color constants
const COLORS = {
  background: "#F0F4F8",
  cardBackground: "#FFFFFF",
  text: "#2C3E50",
  textLight: "#7F8C8D",
  primary: "#005BBB",
  border: "#E8EEF3",
  inputBackground: "#F0F4F8",
  white: "#FFFFFF",
  danger: "#D9534F",
  buttonSecondary: "#6C757D"
};

const CaregiverRemindersScreen = () => {
  const navigation = useNavigation();
  const { activePatient, caregiver } = useCaregiver();
  const { reminders, addReminder, removeReminder, completeReminder, loading: remindersLoading } = useReminders();
  const { fontSize } = useFontSize();
  
  // Modal visibility
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // New reminder data
  const [newTitle, setNewTitle] = useState("");
  const [newHour, setNewHour] = useState("");
  const [newMinute, setNewMinute] = useState("");
  const [newPeriod, setNewPeriod] = useState("AM");
  const [newDate, setNewDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  
  // Recurring reminder options
  const [recurrenceType, setRecurrenceType] = useState("none"); // none, daily, weekly
  const [selectedDays, setSelectedDays] = useState({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false, 
    friday: false,
    saturday: false,
    sunday: false
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  // Completed reminders toggle
  const [showCompletedReminders, setShowCompletedReminders] = useState(false);

  // Verify that reminders is an array and belongs to the active patient
  const validReminders = Array.isArray(reminders) ? reminders : [];

  // Sort and filter reminders
  const sortedReminders = validReminders.sort((a, b) => {
    // Extract hours and minutes
    const getMinutes = (timeStr) => {
      try {
        if (!timeStr) return 0;
        
        const isPM = timeStr.toLowerCase().includes("pm");
        const isAM = timeStr.toLowerCase().includes("am");
        
        // Extract hours and minutes
        const timeParts = timeStr.replace(/[^0-9:]/g, "").split(":");
        let hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        // Convert to 24-hour format
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      } catch (error) {
        return 0;
      }
    };
    
    // First sort by completion status (active reminders first)
    if ((a.isCompleted || a.completed) && !(b.isCompleted || b.completed)) {
      return 1;
    }
    if (!(a.isCompleted || a.completed) && (b.isCompleted || b.completed)) {
      return -1;
    }
    
    // If both have same completion status, sort by date and time
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    
    return getMinutes(a.time) - getMinutes(b.time);
  });

  // Filter to separate completed and active reminders
  const completedReminders = sortedReminders.filter(reminder => reminder.isCompleted || reminder.completed);
  const activeReminders = sortedReminders.filter(reminder => !(reminder.isCompleted || reminder.completed));
  
  // Choose which list to display based on the toggle
  const displayedReminders = showCompletedReminders ? completedReminders : activeReminders;

  // Validate and format time inputs
  const validateHour = (value) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (numericValue === "") {
      setNewHour("");
      return;
    }
    
    const num = parseInt(numericValue, 10);
    if (num >= 1 && num <= 12) {
      setNewHour(numericValue);
    } else {
      Alert.alert("Invalid Hour", "Please enter an hour between 1 and 12.");
    }
  };

  const validateMinute = (value) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (numericValue === "") {
      setNewMinute("");
      return;
    }
    
    const num = parseInt(numericValue, 10);
    if (num >= 0 && num <= 59) {
      setNewMinute(numericValue);
    } else {
      Alert.alert("Invalid Minute", "Please enter minutes between 0 and 59.");
    }
  };

  // Toggle between AM/PM
  const togglePeriod = () => {
    setNewPeriod(prev => prev === "AM" ? "PM" : "AM");
  };

  // Show date picker
  const showDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  // Handle date confirmation
  const handleConfirmDate = (date) => {
    setNewDate(date);
    setIsDatePickerVisible(false);
  };

  // Handle date picker cancellation
  const handleCancelDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  // Toggle day selection for weekly recurrence
  const toggleDay = (day) => {
    setSelectedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  // Get selected days as array
  const getSelectedDaysArray = () => {
    return Object.keys(selectedDays).filter(day => selectedDays[day]);
  };

  // Handle recurrence type change
  const handleRecurrenceChange = (type) => {
    setRecurrenceType(type);
    
    // Clear selected days if not weekly
    if (type !== 'weekly') {
      setSelectedDays({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      });
    }
  };

  // Add a new reminder
  const handleAddReminder = async () => {
    if (!activePatient) {
      Alert.alert(
        "No Active Patient",
        "Please select an active patient before adding reminders.",
        [{ text: "OK", onPress: () => navigation.navigate("CaregiverPatients") }]
      );
      return;
    }
    
    if (!newTitle.trim()) {
      Alert.alert("Error", "Please enter a reminder title.");
      return;
    }
    
    if (!newHour || !newMinute) {
      Alert.alert("Error", "Please enter a valid time.");
      return;
    }
    
    // Validate weekly recurrence requires at least one day selected
    if (recurrenceType === 'weekly' && getSelectedDaysArray().length === 0) {
      Alert.alert("Error", "Please select at least one day for weekly recurrence.");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Format time string
      const hour = parseInt(newHour);
      const minute = parseInt(newMinute);
      const timeString = `${hour}:${minute < 10 ? '0' + minute : minute} ${newPeriod}`;
      
      // Format date string
      const dateString = newDate.toISOString().split('T')[0];
      
      // Set recurrence details
      const recurrence = recurrenceType === 'none' ? null : recurrenceType;
      const recurrenceDays = recurrenceType === 'weekly' ? getSelectedDaysArray() : [];
      
      // Create a proper reminder object
      const reminderObj = {
        title: newTitle.trim(),
        time: timeString,
        date: dateString,
        recurrence: recurrence,
        recurrenceDays: recurrenceDays,
        isPersistent: true, // Added flag to indicate the reminder should persist even after completion
        forPatient: activePatient.email.toLowerCase().trim() // Explicitly set the patient email
      };
      
      // Add the reminder through the context
      const { success } = await addReminder(reminderObj);
      
      if (success) {
        // Reset form and close modal
        setNewTitle("");
        setNewHour("");
        setNewMinute("");
        setNewPeriod("AM");
        setNewDate(new Date());
        setRecurrenceType("none");
        setSelectedDays({
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        });
        setIsModalVisible(false);
        
        // Sync with server
        try {
          console.log('Syncing reminders with server after adding...');
          await syncCaregiverReminders(caregiver.id, activePatient.email);
        } catch (syncError) {
          console.error('Error syncing with server after adding reminder:', syncError);
          // Continue even if sync fails
        }
        
        Alert.alert("Success", "Reminder added successfully.");
      } else {
        Alert.alert("Error", "Failed to add reminder. Please try again.");
      }
    } catch (error) {
      console.error("Error adding reminder:", error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a reminder
  const handleDeleteReminder = (id, title) => {
    Alert.alert(
      "Delete Reminder",
      `Are you sure you want to delete "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeReminder(id);
            
            // Sync with server after deletion
            try {
              if (caregiver && activePatient) {
                console.log('Syncing with server after deleting reminder...');
                await syncCaregiverReminders(caregiver.id, activePatient.email);
              }
            } catch (syncError) {
              console.error('Error syncing with server after deleting reminder:', syncError);
              // Continue even if sync fails
            }
          }
        }
      ]
    );
  };

  // Mark a reminder as completed
  const handleCompleteReminder = (id, title) => {
    Alert.alert(
      "Complete Reminder",
      `Mark "${title}" as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            await completeReminder(id);
            
            // Sync with server after completion
            try {
              if (caregiver && activePatient) {
                console.log('Syncing with server after completing reminder...');
                await syncCaregiverReminders(caregiver.id, activePatient.email);
              }
            } catch (syncError) {
              console.error('Error syncing with server after completing reminder:', syncError);
              // Continue even if sync fails
            }
          }
        }
      ]
    );
  };

  // Render a reminder item
  const renderReminderItem = ({ item }) => {
    // Format completion time if available
    const formatCompletionTime = () => {
      if (item.completedAt) {
        try {
          const completionDate = new Date(item.completedAt);
          return completionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
          return '';
        }
      }
      return '';
    };

    return (
      <View style={styles.reminderItem}>
        <View style={styles.reminderContent}>
          <Text style={[styles.reminderTime, { fontSize: fontSize - 2 }]}>{item.time}</Text>
          <Text style={[
            styles.reminderTitle,
            (item.isCompleted || item.completed) && styles.completedText,
            { fontSize }
          ]}>
            {item.title}
          </Text>
          {item.date && !item.recurrence && (
            <Text style={[styles.reminderDate, { fontSize: fontSize - 2 }]}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          )}
          {item.recurrence && (
            <Text style={[styles.recurrenceText, { fontSize: fontSize - 3 }]}>
              {item.recurrence === 'daily' ? 'Repeats daily' : 
                `Repeats weekly on ${item.recurrenceDays.map(day => 
                  day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}`
              }
            </Text>
          )}
          {(item.isCompleted || item.completed) && (
            <View style={styles.completionInfoContainer}>
              <Text style={[styles.completedLabel, { fontSize: fontSize - 3 }]}>
                Completed
                {item.completedBy === 'user' ? ' by patient' : ''}
                {item.completedAt ? ` at ${formatCompletionTime()}` : ''}
              </Text>
              {item.completedBy === 'user' && (
                <View style={styles.userCompletedBadge}>
                  <Text style={styles.userCompletedText}>✓ Patient</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={styles.reminderActions}>
          {!(item.isCompleted || item.completed) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCompleteReminder(item.id, item.title)}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteReminder(item.id, item.title)}
          >
            <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: fontSize + 4 }]}>Reminders</Text>
        {activePatient ? (
          <Text style={[styles.patientName, { fontSize }]}>
            for {activePatient.name || activePatient.email}
          </Text>
        ) : (
          <TouchableOpacity 
            style={styles.noActivePatientBanner}
            onPress={() => navigation.navigate("CaregiverPatients")}
          >
            <Text style={[styles.noActivePatientText, { fontSize }]}>
              No active patient selected. Tap to select one.
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toggle between active and completed */}
      {activePatient && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !showCompletedReminders && styles.activeToggle
            ]}
            onPress={() => setShowCompletedReminders(false)}
          >
            <Text style={[
              styles.toggleText,
              !showCompletedReminders && styles.activeToggleText,
              { fontSize }
            ]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              showCompletedReminders && styles.activeToggle
            ]}
            onPress={() => setShowCompletedReminders(true)}
          >
            <Text style={[
              styles.toggleText,
              showCompletedReminders && styles.activeToggleText,
              { fontSize }
            ]}>
              Completed ({completedReminders.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reminders List */}
      {isLoading || remindersLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : !activePatient ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={60} color={COLORS.textLight} />
          <Text style={[styles.emptyText, { fontSize: fontSize + 2 }]}>No active patient selected</Text>
          <Text style={[styles.emptySubtext, { fontSize }]}>
            Please select a patient to view and manage their reminders
          </Text>
          <TouchableOpacity
            style={styles.selectPatientButton}
            onPress={() => navigation.navigate("CaregiverPatients")}
          >
            <Text style={[styles.selectPatientButtonText, { fontSize }]}>Select Patient</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedReminders}
          keyExtractor={item => item.id}
          renderItem={renderReminderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color={COLORS.textLight} />
              <Text style={[styles.emptyText, { fontSize: fontSize + 2 }]}>
                {showCompletedReminders
                  ? "No completed reminders"
                  : "No active reminders"}
              </Text>
              <Text style={[styles.emptySubtext, { fontSize }]}>
                {showCompletedReminders
                  ? "Completed reminders will appear here and remain visible until you delete them"
                  : "Tap the + button below to add a reminder"}
              </Text>
            </View>
          }
        />
      )}

      {/* Add Button - only show if an active patient is selected */}
      {activePatient && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalVisible(true)}
        >
          <Ionicons name="add" size={30} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Add Reminder Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: fontSize + 2 }]}>Add Reminder</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { fontSize }]}>Reminder Title</Text>
                <TextInput
                  style={[styles.textInput, { fontSize }]}
                  placeholder="Enter reminder title"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>

              <View style={styles.timeContainer}>
                <Text style={[styles.inputLabel, { fontSize }]}>Time</Text>
                <View style={styles.timeInputsRow}>
                  <View style={styles.timeInputWrapper}>
                    <TextInput
                      style={[styles.timeInput, { fontSize }]}
                      placeholder="HH"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={newHour}
                      onChangeText={validateHour}
                    />
                    <Text style={[styles.timeSeparator, { fontSize }]}>:</Text>
                    <TextInput
                      style={[styles.timeInput, { fontSize }]}
                      placeholder="MM"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={newMinute}
                      onChangeText={validateMinute}
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.periodToggle}
                    onPress={togglePeriod}
                  >
                    <Text style={[styles.periodText, { fontSize }]}>{newPeriod}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.dateContainer}>
                <Text style={[styles.inputLabel, { fontSize }]}>Date</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={showDatePicker}
                >
                  <Text style={[styles.dateButtonText, { fontSize }]}>{formatDate(newDate)}</Text>
                  <Ionicons name="calendar" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              {/* Recurrence Options */}
              <View style={styles.recurrenceContainer}>
                <Text style={styles.inputLabel}>Repeat</Text>
                <View style={styles.recurrenceOptions}>
                  <TouchableOpacity
                    style={[
                      styles.recurrenceOption,
                      recurrenceType === 'none' && styles.recurrenceOptionActive
                    ]}
                    onPress={() => handleRecurrenceChange('none')}
                  >
                    <Text style={[
                      styles.recurrenceOptionText,
                      recurrenceType === 'none' && styles.recurrenceOptionTextActive
                    ]}>None</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.recurrenceOption,
                      recurrenceType === 'daily' && styles.recurrenceOptionActive
                    ]}
                    onPress={() => handleRecurrenceChange('daily')}
                  >
                    <Text style={[
                      styles.recurrenceOptionText,
                      recurrenceType === 'daily' && styles.recurrenceOptionTextActive
                    ]}>Daily</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.recurrenceOption,
                      recurrenceType === 'weekly' && styles.recurrenceOptionActive
                    ]}
                    onPress={() => handleRecurrenceChange('weekly')}
                  >
                    <Text style={[
                      styles.recurrenceOptionText,
                      recurrenceType === 'weekly' && styles.recurrenceOptionTextActive
                    ]}>Weekly</Text>
                  </TouchableOpacity>
                </View>
              
                {/* Day selection for weekly recurrence */}
                {recurrenceType === 'weekly' && (
                  <View style={styles.daysContainer}>
                    <Text style={styles.daysLabel}>Select Days:</Text>
                    <View style={styles.daysGrid}>
                      {Object.keys(selectedDays).map(day => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayOption,
                            selectedDays[day] && styles.dayOptionSelected
                          ]}
                          onPress={() => toggleDay(day)}
                        >
                          <Text style={[
                            styles.dayText,
                            selectedDays[day] && styles.dayTextSelected
                          ]}>
                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleAddReminder}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={handleCancelDatePicker}
        date={newDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
  },
  patientName: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 4,
  },
  noActivePatientBanner: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 5,
  },
  noActivePatientText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  reminderItem: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTime: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 5,
  },
  reminderTitle: {
    fontSize: 16,
    color: COLORS.text,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: COLORS.textLight,
  },
  completedLabel: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
    fontStyle: "italic",
  },
  completionInfoContainer: {
    marginTop: 4,
  },
  userCompletedBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  userCompletedText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  reminderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 5,
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textLight,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  selectPatientButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  selectPatientButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
  },
  addButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    marginHorizontal: 5,
    borderRadius: 5,
  },
  activeToggle: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontWeight: "500",
    color: COLORS.text,
  },
  activeToggleText: {
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  timeContainer: {
    marginBottom: 20,
  },
  timeInputsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  timeInput: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: 60,
    textAlign: "center",
  },
  timeSeparator: {
    fontSize: 20,
    marginHorizontal: 5,
    color: COLORS.text,
  },
  periodToggle: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    width: 60,
    alignItems: "center",
    marginLeft: 10,
  },
  periodText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.inputBackground,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dateContainer: {
    marginVertical: 10,
  },
  dateButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
  },
  reminderDate: {
    color: COLORS.textLight,
    fontSize: 13,
    marginTop: 2,
    fontStyle: "italic",
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  recurrenceContainer: {
    marginVertical: 15,
  },
  recurrenceOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  recurrenceOption: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginHorizontal: 3,
    borderRadius: 5,
    backgroundColor: COLORS.inputBackground,
  },
  recurrenceOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  recurrenceOptionText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  recurrenceOptionTextActive: {
    color: COLORS.white,
  },
  daysContainer: {
    marginTop: 15,
  },
  daysLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayOption: {
    width: '13%',
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 8,
    backgroundColor: COLORS.inputBackground,
  },
  dayOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: 12,
    color: COLORS.text,
  },
  dayTextSelected: {
    color: COLORS.white,
  },
  recurrenceText: {
    fontSize: 12,
    color: COLORS.primary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});

export default CaregiverRemindersScreen;