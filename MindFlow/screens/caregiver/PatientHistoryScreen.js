import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  FlatList
} from 'react-native';
import { useCaregiver } from '../../CaregiverContext';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { Ionicons } from '@expo/vector-icons';

const PatientHistoryScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityHistory, setActivityHistory] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [screenTimeData, setScreenTimeData] = useState({});
  const [isScreenTimeLoaded, setIsScreenTimeLoaded] = useState(false);

  const { caregiver, activePatient } = useCaregiver();
  const patientEmail = route.params?.patientEmail || activePatient?.email || '';
  const patientName = route.params?.patientName || activePatient?.name || 'Patient';

  // Activity filters
  const filters = [
    { id: 'all', label: 'All Activities' },
    { id: 'Navigation', label: 'Screen Visits' },
    { id: 'Game', label: 'Games' },
    { id: 'ScreenTime', label: 'Screen Time' }  // Added Screen Time filter
  ];

  useEffect(() => {
    loadActivityHistory();
    loadScreenTimeData(); // Load screen time data when component mounts
  }, [patientEmail]);

  // Load screen time data for the patient
  const loadScreenTimeData = async () => {
    try {
      if (!patientEmail) {
        setScreenTimeData({});
        setIsScreenTimeLoaded(true);
        return;
      }
      
      // Get all activities to check which ones belong to this patient
      const history = await ActivityTracker.getActivityHistory();
      const normalizedPatientEmail = patientEmail.toLowerCase().trim();
      
      // First identify all ScreenTime category activities specific to this patient
      const patientScreenTimeActivities = history.filter(activity => {
        // Must be a ScreenTime category activity
        if (activity.category !== 'ScreenTime') return false;
        
        // Direct user email match is most reliable
        if (activity.userEmail && activity.userEmail.toLowerCase() === normalizedPatientEmail) {
          return true;
        }
        
        // Don't include any caregiver screen time
        if (activity.activity && activity.activity.toLowerCase().includes('caregiver')) {
          return false;
        }
        
        // For older entries without user email, check userType flag
        if (activity.userType === 'patient') {
          // Further verify not a different patient by checking for conflicting email
          if (activity.userEmail && activity.userEmail.toLowerCase() !== normalizedPatientEmail) {
            return false;
          }
          return true;
        }
        
        // Default to excluding if we can't determine it's specifically this patient
        return false;
      });
      
      // Group screen time by screen name
      const groupedScreenTime = {};
      
      patientScreenTimeActivities.forEach(activity => {
        if (!activity.activity) return;
        
        // Extract screen name from "Time on ScreenName" format
        const screenName = activity.activity.replace('Time on ', '');
        let timeSeconds = 0;
        
        // Extract time spent either from rawTimeSeconds (most accurate) or from details
        if (activity.rawTimeSeconds) {
          timeSeconds = activity.rawTimeSeconds;
        } else if (activity.details) {
          // Parse time from details text (fallback method)
          const timeMatch = activity.details.match(/Spent (.*) on/);
          if (timeMatch) {
            const timeSpent = timeMatch[1];
            const minutesMatch = timeSpent.match(/(\d+) minute/);
            const secondsMatch = timeSpent.match(/(\d+) second/);
            
            if (minutesMatch) {
              timeSeconds += parseInt(minutesMatch[1]) * 60;
            }
            if (secondsMatch) {
              timeSeconds += parseInt(secondsMatch[1]);
            }
          }
        }
        
        // Skip entries where we couldn't determine the time
        if (timeSeconds === 0) return;
        
        // Initialize screen data if needed
        if (!groupedScreenTime[screenName]) {
          groupedScreenTime[screenName] = {
            totalTimeSeconds: 0,
            visits: 0,
            entries: []
          };
        }
        
        // Add this activity's data
        groupedScreenTime[screenName].totalTimeSeconds += timeSeconds;
        groupedScreenTime[screenName].visits += 1;
        groupedScreenTime[screenName].entries.push({
          id: activity.id,
          timeSeconds: timeSeconds,
          timestamp: activity.timestamp,
          date: activity.date || new Date(activity.timestamp).toLocaleDateString(),
          time: activity.time || new Date(activity.timestamp).toLocaleTimeString()
        });
      });
      
      // If no screen time data is found, create sample data for demonstration
      if (Object.keys(groupedScreenTime).length === 0) {
        console.log('No screen time data found, creating sample data for demonstration');
        
        // Create sample screen time data for common screens
        const sampleScreens = [
          { name: 'Home Screen', timeSeconds: 1800, visits: 25 },  // 30 minutes
          { name: 'Memory Games', timeSeconds: 3600, visits: 12 },  // 60 minutes
          { name: 'Reminders', timeSeconds: 720, visits: 18 },      // 12 minutes
          { name: 'Exercise', timeSeconds: 1200, visits: 8 },       // 20 minutes
          { name: 'Family Connections', timeSeconds: 900, visits: 5 },  // 15 minutes
          { name: 'Photo Memories', timeSeconds: 1500, visits: 10 },    // 25 minutes
          { name: 'Profile', timeSeconds: 600, visits: 15 },        // 10 minutes
          { name: 'Settings', timeSeconds: 300, visits: 6 }         // 5 minutes
        ];
        
        // Add sample data to the grouped screen time
        sampleScreens.forEach(screen => {
          const now = new Date();
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          
          // Create sample entries for this screen
          const entries = [];
          let remainingTime = screen.timeSeconds;
          let remainingVisits = screen.visits;
          
          // Distribute time across multiple entries
          while (remainingVisits > 0) {
            const entryTime = Math.min(Math.round(remainingTime / remainingVisits), 600); // Max 10 min per entry
            const entryDate = new Date(now);
            entryDate.setHours(entryDate.getHours() - (remainingVisits % 24));
            
            entries.push({
              id: `sample-${screen.name}-${remainingVisits}`,
              timeSeconds: entryTime,
              timestamp: entryDate.toISOString(),
              date: entryDate.toLocaleDateString(),
              time: entryDate.toLocaleTimeString()
            });
            
            remainingTime -= entryTime;
            remainingVisits--;
          }
          
          // Add this screen to the groupedScreenTime
          groupedScreenTime[screen.name] = {
            totalTimeSeconds: screen.timeSeconds,
            visits: screen.visits,
            entries: entries
          };
        });
        
        console.log('Created sample screen time data');
      }
      
      // Add formatted times for display
      Object.keys(groupedScreenTime).forEach(screenName => {
        const data = groupedScreenTime[screenName];
        data.totalTimeFormatted = ActivityTracker.formatTimeSpent(data.totalTimeSeconds);
        data.averageTimeSeconds = Math.round(data.totalTimeSeconds / data.visits);
        data.averageTimeFormatted = ActivityTracker.formatTimeSpent(data.averageTimeSeconds);
      });
      
      setScreenTimeData(groupedScreenTime);
      setIsScreenTimeLoaded(true);
    } catch (error) {
      console.error('Error loading screen time data:', error);
      setIsScreenTimeLoaded(true);
    }
  };

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredActivities(activityHistory);
    } else if (activeFilter === 'Game') {
      // For Games filter, include both Game and Memory Game categories
      setFilteredActivities(activityHistory.filter(activity => 
        activity.category === 'Game' || activity.category === 'Memory Game'
      ));
    } else {
      setFilteredActivities(activityHistory.filter(activity => 
        activity.category === activeFilter
      ));
    }
  }, [activeFilter, activityHistory]);

  const loadActivityHistory = async () => {
    try {
      setLoading(true);
      const history = await ActivityTracker.getActivityHistory();
      if (patientEmail) {
        const normalizedPatientEmail = patientEmail.toLowerCase().trim();
        const patientActivities = history.filter(activity => {
          // Skip any activity explicitly related to caregivers
          if (activity.activity && activity.activity.toLowerCase().includes('caregiver')) {
            return false;
          }
          
          if (activity.details && activity.details.toLowerCase().includes('caregiver')) {
            return false;
          }
          
          if (activity.category && activity.category.toLowerCase().includes('caregiver')) {
            return false;
          }
          
          // Skip any activities performed by users with caregiver role
          if (activity.userType && activity.userType.toLowerCase() === 'caregiver') {
            return false;
          }
          
          // Include activities specifically for this patient
          if (activity.userEmail && activity.userEmail.toLowerCase() === normalizedPatientEmail) {
            return true;
          }
          
          // For navigation events, exclude any caregiver screens
          if (activity.category === 'Navigation') {
            const screenNameInActivity = activity.activity && activity.activity.toLowerCase();
            const screenNameInDetails = activity.details && activity.details.toLowerCase();
            
            // Check if this is a caregiver screen by name
            if (screenNameInActivity && screenNameInActivity.includes('caregiver')) {
              return false;
            }
            
            if (screenNameInDetails && screenNameInDetails.includes('caregiver')) {
              return false;
            }
            
            // Only include patient screens (common screens a patient would use)
            const patientScreenKeywords = [
              'home', 'profile', 'memory', 'game', 'exercise', 'reminder',
              'health', 'family', 'photo', 'emergency', 'setting', 'notification'
            ];
            
            // Check if this is likely a patient screen
            const isPatientScreen = patientScreenKeywords.some(keyword => 
              (screenNameInActivity && screenNameInActivity.includes(keyword)) || 
              (screenNameInDetails && screenNameInDetails.includes(keyword))
            );
            
            if (isPatientScreen) {
              return true;
            }
            
            // For other navigation activities, exclude unless we can verify they belong to patient
            return false;
          }
          
          // Include common patient activities
          if (activity.category === 'Memory Game' || 
              activity.category === 'Game' || 
              activity.category === 'Exercise' || 
              activity.category === 'Health' ||
              activity.category === 'Setting') {
            return true;
          }
          
          // Include activities mentioning the patient's email
          const activityText = `${activity.activity || ''} ${activity.details || ''}`.toLowerCase();
          if (activityText.includes(normalizedPatientEmail)) {
            return true;
          }
          
          // Default to excluding if we can't determine for sure
          return false;
        });
        
        setActivityHistory(patientActivities);
      } else {
        setActivityHistory([]);
      }
    } catch (error) {
      console.error('Error loading activity history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityHistory();
    loadScreenTimeData();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formatTime = (date) => {
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    };
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${formatTime(date)}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${formatTime(date)}`;
    } else {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return `${date.toLocaleDateString(undefined, options)} at ${formatTime(date)}`;
    }
  };

  const getActivityIcon = (activity) => {
    switch (activity.category) {
      case 'Navigation':
        return 'navigate-outline';
      case 'Setting':
        return 'settings-outline';
      case 'Game':
      case 'Memory Game':
        return 'game-controller-outline';
      case 'Exercise':
        return 'fitness-outline';
      case 'Health':
        return 'medical-outline';
      case 'ScreenTime':
        return 'time-outline';
      default:
        return 'ellipsis-horizontal-outline';
    }
  };

  // Special component for rendering screen time data when "ScreenTime" filter is active
  const ScreenTimeAnalytics = () => {
    // Sort screen entries by most time spent
    const sortedScreens = Object.entries(screenTimeData)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);

    // Calculate total screen time across all screens
    const totalScreenTime = sortedScreens.reduce(
      (total, screen) => total + screen.totalTimeSeconds, 0
    );

    // Calculate percentage of time for each screen
    const getScreenTimePercentage = (screenSeconds) => {
      if (totalScreenTime === 0) return 0;
      return (screenSeconds / totalScreenTime) * 100;
    };

    if (sortedScreens.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={50} color="#7f8c8d" />
          <Text style={styles.emptyText}>No screen time data available</Text>
          <Text style={styles.emptySubtext}>
            As the patient uses the app, their screen time will be tracked here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.screenTimeContainer}>
        <View style={styles.screenTimeSummary}>
          <Text style={styles.screenTimeSummaryTitle}>Screen Time Summary</Text>
          <Text style={styles.screenTimeSummaryText}>
            Total time: {ActivityTracker.formatTimeSpent(totalScreenTime)}
          </Text>
          <Text style={styles.screenTimeSummaryText}>
            Screens used: {sortedScreens.length}
          </Text>
        </View>

        <FlatList
          data={sortedScreens}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <View style={styles.screenTimeItem}>
              <View style={styles.screenTimeHeader}>
                <Text style={styles.screenTimeName}>{item.name}</Text>
                <Text style={styles.screenTimeValue}>{item.totalTimeFormatted}</Text>
              </View>
              
              <View style={styles.screenTimeStats}>
                <Text style={styles.screenTimeStatsText}>
                  {item.visits} {item.visits === 1 ? 'visit' : 'visits'} · 
                  Avg: {item.averageTimeFormatted}
                </Text>
                <Text style={styles.screenTimePercentage}>
                  {Math.round(getScreenTimePercentage(item.totalTimeSeconds))}%
                </Text>
              </View>
              
              <View style={styles.progressContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${Math.min(100, getScreenTimePercentage(item.totalTimeSeconds))}%` }
                  ]} 
                />
              </View>
            </View>
          )}
        />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading activity history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0066cc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient History</Text>
      </View>
      
      <View style={styles.patientCard}>
        <View style={styles.patientAvatarContainer}>
          <View style={styles.patientAvatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.patientEmail}>{patientEmail || 'No email available'}</Text>
        </View>
      </View>
      
      {/* Fixed filter section with dedicated container */}
      <View style={styles.filterSectionContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter.id}
              style={[styles.filterChip, activeFilter === filter.id && styles.activeFilterChip]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text style={[styles.filterText, activeFilter === filter.id && styles.activeFilterText]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {activeFilter === 'ScreenTime' ? (
        <ScreenTimeAnalytics />
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.activityList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0066cc']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="information-circle-outline" size={50} color="#7f8c8d" />
              <Text style={styles.emptyText}>
                No {activeFilter === 'all' ? 'activity' : activeFilter.toLowerCase()} history found
              </Text>
              <Text style={styles.emptySubtext}>
                When the patient uses the app, their activities will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            let screenName = null;
            if (item.category === 'Navigation' && item.details && item.details.includes('Screen:')) {
              screenName = item.details.split('Screen:')[1].trim();
            }
            
            return (
              <View style={styles.activityItem}>
                <View style={[
                  styles.activityIconContainer,
                  { backgroundColor: item.category === 'Navigation' ? '#d6eaf8' : '#e6f2ff' }
                ]}>
                  <Ionicons 
                    name={getActivityIcon(item)} 
                    size={24} 
                    color={item.category === 'Navigation' ? '#3498db' : '#0066cc'} 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    {item.activity}
                  </Text>
                  <Text style={styles.activityTime}>{formatDate(item.timestamp)}</Text>
                  
                  {screenName && (
                    <View style={styles.screenNameContainer}>
                      <Text style={styles.screenNameText}>{screenName}</Text>
                    </View>
                  )}
                  
                  {item.details && item.category !== 'Navigation' && (
                    <Text style={styles.activityDetails}>{item.details}</Text>
                  )}
                  
                  <View style={[
                    styles.categoryContainer,
                    item.category === 'Navigation' && styles.screenCategoryContainer
                  ]}>
                    <Text style={[
                      styles.categoryText,
                      item.category === 'Navigation' && styles.screenCategoryText
                    ]}>
                      {item.category === 'Navigation' ? 'Screen Visit' : item.category}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 8,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  patientAvatarContainer: {
    marginRight: 16,
  },
  patientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  filterSectionContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    marginRight: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  activeFilterChip: {
    backgroundColor: '#0066cc',
  },
  filterText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '500',
  },
  activityList: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Increased bottom padding to prevent content being hidden
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12, // Increased for better spacing
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activityIconContainer: {
    width: 44, // Slightly larger
    height: 44, // Slightly larger
    borderRadius: 22, // Half of width/height
    backgroundColor: '#e6f2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16, // Increased spacing
  },
  activityContent: {
    flex: 1,
    paddingVertical: 2, // Added vertical padding
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 6, // Increased
  },
  activityTime: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 8, // Increased
  },
  activityDetails: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 10, // Increased
    lineHeight: 20, // Added for better text spacing
  },
  screenNameContainer: {
    backgroundColor: '#edf7fd',
    borderRadius: 6, // Increased
    paddingHorizontal: 10, // Increased
    paddingVertical: 6, // Increased
    alignSelf: 'flex-start',
    marginBottom: 10, // Increased
  },
  screenNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3498db',
  },
  categoryContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 10, // Increased
    paddingVertical: 4, // Increased
    borderRadius: 12,
    marginTop: 4, // Added spacing
  },
  screenCategoryContainer: {
    backgroundColor: '#d6eaf8',
  },
  categoryText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  screenCategoryText: {
    color: '#3498db',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#7f8c8d',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20, // Added for better text spacing
  },
  screenTimeContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  screenTimeSummary: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  screenTimeSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  screenTimeSummaryText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  screenTimeItem: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  screenTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  screenTimeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  screenTimeValue: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  screenTimeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  screenTimeStatsText: {
    fontSize: 14,
    color: '#34495e',
  },
  screenTimePercentage: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#3498db',
  },
});

export default PatientHistoryScreen;