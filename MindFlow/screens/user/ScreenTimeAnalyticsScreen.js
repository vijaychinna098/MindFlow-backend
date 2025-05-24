import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from '../../FontSizeContext';

const ScreenTimeAnalyticsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [screenTimeData, setScreenTimeData] = useState({});
  const [sortType, setSortType] = useState('mostTime'); // 'mostTime', 'mostVisits', 'alphabetical'
  const { fontSize } = useFontSize();
  
  useEffect(() => {
    loadScreenTimeData();
  }, []);
  
  const loadScreenTimeData = async () => {
    try {
      setLoading(true);
      const data = await ActivityTracker.getScreenTimeData();
      setScreenTimeData(data);
    } catch (error) {
      console.error('Error loading screen time data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const sortedScreenTimeData = () => {
    const screenEntries = Object.entries(screenTimeData).map(([name, data]) => ({
      name,
      ...data
    }));
    
    switch (sortType) {
      case 'mostTime':
        return screenEntries.sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);
      case 'mostVisits':
        return screenEntries.sort((a, b) => b.visits - a.visits);
      case 'alphabetical':
        return screenEntries.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return screenEntries;
    }
  };
  
  // Calculate total screen time
  const calculateTotalTime = () => {
    return Object.values(screenTimeData).reduce(
      (total, screen) => total + screen.totalTimeSeconds, 
      0
    );
  };
  
  // Calculate total screen visits
  const calculateTotalVisits = () => {
    return Object.values(screenTimeData).reduce(
      (total, screen) => total + screen.visits, 
      0
    );
  };

  // Generate percentage for progress bar
  const getScreenTimePercentage = (screenSeconds) => {
    const totalSeconds = calculateTotalTime();
    if (totalSeconds === 0) return 0;
    return (screenSeconds / totalSeconds) * 100;
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={[styles.loadingText, { fontSize }]}>Loading screen time data...</Text>
      </View>
    );
  }
  
  const screenData = sortedScreenTimeData();
  const totalScreenTime = ActivityTracker.formatTimeSpent(calculateTotalTime());
  const totalVisits = calculateTotalVisits();
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0066cc" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize + 4 }]}>Screen Time Analytics</Text>
      </View>
      
      <View style={styles.summaryCard}>
        <Text style={[styles.summaryTitle, { fontSize }]}>Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { fontSize: fontSize + 2 }]}>{totalScreenTime}</Text>
            <Text style={[styles.summaryLabel, { fontSize: fontSize - 2 }]}>Total Time</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { fontSize: fontSize + 2 }]}>{screenData.length}</Text>
            <Text style={[styles.summaryLabel, { fontSize: fontSize - 2 }]}>Screens Visited</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { fontSize: fontSize + 2 }]}>{totalVisits}</Text>
            <Text style={[styles.summaryLabel, { fontSize: fontSize - 2 }]}>Total Visits</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.sortContainer}>
        <Text style={[styles.sortLabel, { fontSize: fontSize - 2 }]}>Sort by:</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity 
            style={[styles.sortButton, sortType === 'mostTime' && styles.activeSortButton]}
            onPress={() => setSortType('mostTime')}
          >
            <Text style={[
              styles.sortButtonText, 
              { fontSize: fontSize - 2 },
              sortType === 'mostTime' && styles.activeSortButtonText
            ]}>
              Most Time
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.sortButton, sortType === 'mostVisits' && styles.activeSortButton]}
            onPress={() => setSortType('mostVisits')}
          >
            <Text style={[
              styles.sortButtonText, 
              { fontSize: fontSize - 2 },
              sortType === 'mostVisits' && styles.activeSortButtonText
            ]}>
              Most Visits
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.sortButton, sortType === 'alphabetical' && styles.activeSortButton]}
            onPress={() => setSortType('alphabetical')}
          >
            <Text style={[
              styles.sortButtonText, 
              { fontSize: fontSize - 2 },
              sortType === 'alphabetical' && styles.activeSortButtonText
            ]}>
              A-Z
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {screenData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={60} color="#cccccc" />
          <Text style={[styles.emptyText, { fontSize }]}>No screen time data available yet</Text>
          <Text style={[styles.emptySubtext, { fontSize: fontSize - 2 }]}>
            As you use the app, we'll track how much time you spend on each screen
          </Text>
        </View>
      ) : (
        <FlatList
          data={screenData}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.screensList}
          renderItem={({ item }) => (
            <View style={styles.screenCard}>
              <View style={styles.screenInfo}>
                <Text style={[styles.screenName, { fontSize }]}>{item.name}</Text>
                <Text style={[styles.screenTimeText, { fontSize: fontSize - 2 }]}>
                  {item.totalTimeFormatted} · {item.visits} {item.visits === 1 ? 'visit' : 'visits'}
                </Text>
                <View style={styles.progressContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${Math.min(100, getScreenTimePercentage(item.totalTimeSeconds))}%` }
                    ]} 
                  />
                </View>
              </View>
              <View style={styles.screenStats}>
                <Text style={[styles.screenTimePercent, { fontSize: fontSize - 2 }]}>
                  {Math.round(getScreenTimePercentage(item.totalTimeSeconds))}%
                </Text>
              </View>
            </View>
          )}
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
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#7f8c8d',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sortLabel: {
    color: '#7f8c8d',
    marginRight: 8,
  },
  sortButtons: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
  },
  activeSortButton: {
    backgroundColor: '#0066cc',
  },
  sortButtonText: {
    color: '#7f8c8d',
  },
  activeSortButtonText: {
    color: '#fff',
  },
  screensList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  screenCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  screenInfo: {
    flex: 1,
  },
  screenName: {
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 4,
  },
  screenTimeText: {
    color: '#7f8c8d',
    marginBottom: 8,
  },
  screenStats: {
    justifyContent: 'center',
    minWidth: 40,
    alignItems: 'flex-end',
  },
  screenTimePercent: {
    fontWeight: 'bold',
    color: '#0066cc',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#0066cc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontWeight: '500',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default ScreenTimeAnalyticsScreen;