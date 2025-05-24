import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../UserContext';
import { stopSpeech, speakWithVoiceCheck } from '../../utils/SpeechManager';
import { useFontSize } from '../user/FontSizeContext'; // Updated import path
import { Video } from 'expo-av'; // Import Video component for video playback

const MemoriesScreen = () => {
  const { currentUser } = useUser();
  const { fontSize } = useFontSize();
  
  const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
  const storageKey = userEmail ? `memories_${userEmail}` : 'memories';
  const username = currentUser?.name || currentUser?.username || 'User';
  const [memories, setMemories] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [isVideoFullScreen, setIsVideoFullScreen] = useState(false);
  const [isFullScreenModalVisible, setIsFullScreenModalVisible] = useState(false);
  const [connectedCaregiverEmail, setConnectedCaregiverEmail] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRefs = useRef({});
  const fullscreenVideoRef = useRef(null);

  // Load voice assistance setting
  useEffect(() => {
    const loadVoiceAssistanceSetting = async () => {
      try {
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        setVoiceAssistanceEnabled(storedVoiceAssistance === 'true');
        console.log("Voice assistance is", storedVoiceAssistance === 'true' ? "enabled" : "disabled");
      } catch (error) {
        console.error('Error loading voice assistance setting:', error);
      }
    };
    
    loadVoiceAssistanceSetting();
  }, []);

  // Check for connected caregiver
  useEffect(() => {
    const checkCaregiverConnection = async () => {
      if (!userEmail) return;
      
      try {
        // Check if this user is connected to a caregiver
        const mappingKey = `memory_mapping_${userEmail}`;
        const caregiverEmail = await AsyncStorage.getItem(mappingKey);
        
        if (caregiverEmail) {
          console.log(`User memories connected to caregiver: ${caregiverEmail}`);
          setConnectedCaregiverEmail(caregiverEmail);
          
          // Check if caregiver has memories for this patient
          await checkCaregiverMemories(caregiverEmail);
        }
      } catch (error) {
        console.error("Failed to check caregiver connection for memories:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkCaregiverConnection();
  }, [userEmail]);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        setLoading(true);
        const storedMemories = await AsyncStorage.getItem(storageKey);
        if (storedMemories !== null) {
          const parsedMemories = JSON.parse(storedMemories);
          
          // Ensure parsedMemories is an array before filtering
          if (Array.isArray(parsedMemories)) {
            // Filter to ensure only memories for this user are shown and each memory is a valid object
            const userMemories = parsedMemories.filter(memory => 
              memory && 
              typeof memory === 'object' &&
              (!memory.forPatient || 
               (typeof memory.forPatient === 'string' && 
                memory.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim()))
            );
            
            setMemories(userMemories);
            console.log(`Loaded ${userMemories.length} memories specific to user: ${userEmail}`);
          } else {
            console.error("Stored memories is not an array:", parsedMemories);
            setMemories([]);
          }
        } else {
          // Initialize with empty array if no memories found
          setMemories([]);
        }
      } catch (error) {
        console.error("Failed to load memories:", error);
        setMemories([]);
      } finally {
        setLoading(false);
      }
    };
    loadMemories();
  }, [storageKey, userEmail]);

  // Function to check if caregiver has set memories for this patient
  const checkCaregiverMemories = async (caregiverEmail) => {
    if (!caregiverEmail || !userEmail) return;
    
    try {
      // Check caregiver's memories
      const caregiverKey = `memories_${caregiverEmail}`;
      const caregiverMemoriesData = await AsyncStorage.getItem(caregiverKey);
      
      if (caregiverMemoriesData) {
        const allCaregiverMemories = JSON.parse(caregiverMemoriesData);
        
        // Ensure allCaregiverMemories is an array
        if (!Array.isArray(allCaregiverMemories)) {
          console.error("Caregiver memories is not an array");
          return;
        }
        
        console.log(`Found ${allCaregiverMemories.length} total memories from caregiver`);
        
        // Filter to only include memories for this specific user and ensure each memory is valid
        const userMemories = allCaregiverMemories.filter(memory => 
          memory && 
          typeof memory === 'object' &&
          memory.forPatient && 
          typeof memory.forPatient === 'string' &&
          memory.forPatient.toLowerCase().trim() === userEmail.toLowerCase().trim()
        );
        
        console.log(`Filtered to ${userMemories.length} memories assigned to this user`);
        
        // Update our memories from caregiver's list
        if (userMemories.length > 0) {
          // Save to user's own storage to maintain persistence
          await AsyncStorage.setItem(storageKey, JSON.stringify(userMemories));
          
          // Update state
          setMemories(userMemories);
          setLastSyncTime(new Date().toLocaleString());
          console.log("Synced user-specific memories from caregiver");
        }
      }
    } catch (error) {
      console.error("Failed to fetch caregiver memories:", error);
    }
  };

  const handleOpenMemory = (memory) => {
    if (!memory || typeof memory !== 'object') {
      console.error("Invalid memory object:", memory);
      return;
    }
    
    setSelectedMemory(memory);
    setIsFullScreenModalVisible(true);
    
    // Only speak if voice assistance is enabled
    if (voiceAssistanceEnabled) {
      // Construct a message to read out
      const relationText = memory.relation ? `${memory.relation}` : '';
      
      let message = '';
      if (memory.gender && memory.gender.toLowerCase() === 'female') {
        message = `Dear ${username}, she is your ${relationText}. Her name is ${memory.title || 'Unknown'}. ${memory.description || ''} ${memory.birthday ? `Her birthday is on ${memory.birthday}` : ''}`;
      } else {
        message = `Dear ${username}, he is your ${relationText}. His name is ${memory.title || 'Unknown'}. ${memory.description || ''} ${memory.birthday ? `His birthday is on ${memory.birthday}` : ''}`;
      }
      
      speakWithVoiceCheck(message, true, true);
      setIsSpeaking(true);
    }
  };

  const handleCloseFullScreenModal = () => {
    stopSpeech();
    setIsSpeaking(false);
    
    // Unload video if present before closing modal
    if (selectedMemory?.mediaType === 'video' && fullscreenVideoRef.current) {
      try {
        fullscreenVideoRef.current.unloadAsync();
      } catch (error) {
        console.log("Error unloading fullscreen video:", error);
      }
    }
    
    setIsFullScreenModalVisible(false);
    setSelectedMemory(null);
  };

  // Toggle speaking/stop speaking
  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else if (selectedMemory && voiceAssistanceEnabled) {
      // Speak the message again
      const relationText = selectedMemory.relation ? `${selectedMemory.relation}` : '';
      let message = '';
      
      if (selectedMemory.gender && selectedMemory.gender.toLowerCase() === 'female') {
        message = `Dear ${username}, she is your ${relationText}. Her name is ${selectedMemory.title || 'Unknown'}. ${selectedMemory.description || ''} ${selectedMemory.birthday ? `Her birthday is on ${selectedMemory.birthday}` : ''}`;
      } else {
        message = `Dear ${username}, he is your ${relationText}. His name is ${selectedMemory.title || 'Unknown'}. ${selectedMemory.description || ''} ${selectedMemory.birthday ? `His birthday is on ${selectedMemory.birthday}` : ''}`;
      }
      
      speakWithVoiceCheck(message, true, true);
      setIsSpeaking(true);
    }
  };

  // Function to handle video playback status changes
  const handleVideoPlaybackStatusUpdate = (status) => {
    if (status.isPlaying) {
      // Video is playing, stop voice assistance
      stopSpeech();
      setIsSpeaking(false);
      setIsVideoPlaying(true);
    } else {
      setIsVideoPlaying(false);
    }
  };

  const renderMemory = ({ item }) => {
    // If item is falsy or not an object, return an empty view
    if (!item || typeof item !== 'object') {
      return <View style={{ display: 'none' }} />;
    }
    
    // Use a safe method to get image and prevent errors
    let defaultImage;
    try {
      defaultImage = (item.gender && item.gender.toLowerCase() === 'female')
        ? require('../images/girl.jpg') 
        : require('../images/boy.png');
    } catch (e) {
      // Fallback to boy image if there's any problem with require
      defaultImage = require('../images/boy.png');
    }
    
    // Safe getter for optional values
    const safeGet = (obj, path, defaultValue) => {
      try {
        return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj) || defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };
    
    // Check if this memory has a video
    const hasVideo = item.mediaType === 'video' && item.video;
    
    return (
      <TouchableOpacity
        style={styles.memoryItem}
        onPress={() => handleOpenMemory(item)}
      >
        {hasVideo ? (
          <Video
            ref={ref => (videoRefs.current[item.id] = ref)}
            source={{ uri: item.video }}
            style={styles.memoryImage}
            useNativeControls
            resizeMode="cover"
            onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
            onError={(error) => {
              console.error(`Video playback error for memory ${item.id}:`, error);
            }}
          />
        ) : (
          <Image 
            source={item.image ? { uri: item.image } : defaultImage}
            style={styles.memoryImage}
            defaultSource={defaultImage}
          />
        )}
        <View style={styles.memoryInfo}>
          <Text style={[styles.memoryTitle, { fontSize: fontSize }]}>{item.title || ''}</Text>
          <Text style={[styles.memoryRelation, { fontSize: fontSize - 4 }]}>
            Relation: {safeGet(item, 'relation', 'Unknown')}
          </Text>
          <Text style={[styles.memoryBirthday, { fontSize: fontSize - 4 }]}>
            Birthday: {safeGet(item, 'birthday', 'Unknown')}
          </Text>
          {hasVideo && (
            <View style={styles.videoIndicator}>
              <Ionicons name="videocam" size={16} color="#005BBB" />
              <Text style={styles.videoIndicatorText}>Video</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: fontSize + 4 }]}>Memories</Text>
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#005BBB" />
        <Text style={[styles.infoText, { fontSize: fontSize - 4 }]}>Read-only memories</Text>
        <Text style={[styles.infoText, { fontSize: fontSize - 4 }]}>Contact your caregiver for updates</Text>
        {connectedCaregiverEmail && lastSyncTime && (
          <Text style={[styles.syncText, { fontSize: fontSize - 4 }]}>
            Last updated: {lastSyncTime}
          </Text>
        )}
      </View>
      
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { fontSize: fontSize }]}>Loading...</Text>
        </View>
      ) : memories && memories.length > 0 ? (
        <FlatList
          data={memories}
          renderItem={renderMemory}
          keyExtractor={(item, index) => item?.id ? String(item.id) : `memory-${index}`}
          contentContainerStyle={styles.memoriesList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { fontSize: fontSize }]}>No memories found</Text>
        </View>
      )}
      
      {/* Video Full Screen Modal */}
      <Modal
        visible={isVideoFullScreen}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsVideoFullScreen(false)}
      >
        <View style={styles.videoFullScreenContainer}>
          {selectedMemory?.mediaType === 'video' && selectedMemory?.video && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: selectedMemory.video }}
              style={styles.videoFullScreen}
              useNativeControls
              resizeMode="contain"
              shouldPlay={true}
              isLooping={false}
              onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
            />
          )}
          <TouchableOpacity
            style={styles.videoFullScreenCloseButton}
            onPress={() => setIsVideoFullScreen(false)}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
      
      {/* Full Screen Modal for memory details */}
      <Modal
        visible={isFullScreenModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseFullScreenModal}
      >
        {selectedMemory && (
          <View style={styles.fullScreenModalContainer}>
            <View style={styles.fullScreenModalHeader}>
              <TouchableOpacity
                style={styles.fullScreenModalCloseButton}
                onPress={handleCloseFullScreenModal}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.fullScreenContent}>
              {selectedMemory.mediaType === 'video' && selectedMemory.video ? (
                <View style={styles.videoContainer}>
                  <Video
                    ref={fullscreenVideoRef}
                    source={{ uri: selectedMemory.video }}
                    style={styles.fullScreenImage}
                    useNativeControls
                    resizeMode="contain"
                    onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
                    onError={(error) => {
                      console.error("Fullscreen video error:", error);
                    }}
                  />
                  <TouchableOpacity 
                    style={styles.expandButton}
                    onPress={() => setIsVideoFullScreen(true)}
                  >
                    <Ionicons name="expand" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <Image
                  source={selectedMemory.image ? { uri: selectedMemory.image } : 
                    (selectedMemory.gender === 'female' ? require('../images/girl.jpg') : require('../images/boy.png'))}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
              
              <View style={styles.fullScreenInfo}>
                <Text style={[styles.fullScreenTitle, { fontSize: fontSize + 4 }]}>{selectedMemory.title || 'Unknown'}</Text>
                <Text style={[styles.fullScreenRelation, { fontSize: fontSize }]}>
                  Relation: {selectedMemory.relation || 'Unknown'}
                </Text>
                <Text style={[styles.fullScreenBirthday, { fontSize: fontSize }]}>
                  Birthday: {selectedMemory.birthday || 'Unknown'}
                </Text>
                <Text style={[styles.fullScreenDescription, { fontSize: fontSize }]}>
                  Description: {selectedMemory.description || 'No description available'}
                </Text>
                {selectedMemory.tags && (
                  <Text style={[styles.fullScreenTags, { fontSize: fontSize }]}>
                    Tags: {selectedMemory.tags}
                  </Text>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.speakButton}
                onPress={toggleSpeech}
              >
                <Ionicons 
                  name={isSpeaking ? "volume-mute" : "volume-high"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={[styles.speakButtonText, { fontSize: fontSize }]}>
                  {isSpeaking ? 'Stop' : 'Speak'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F0F4F8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  infoBox: {
    backgroundColor: '#E8F4FF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#005BBB',
  },
  infoText: {
    color: '#333',
    marginTop: 5,
    textAlign: 'center',
    fontSize: 14,
  },
  syncText: {
    color: '#333',
    marginTop: 5,
    textAlign: 'center',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  memoriesList: {
    paddingBottom: 20,
  },
  memoryItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  memoryImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  memoryInfo: {
    flex: 1,
    padding: 15,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  memoryRelation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  memoryBirthday: {
    fontSize: 14,
    color: '#666',
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  videoIndicatorText: {
    fontSize: 14,
    color: '#005BBB',
    marginLeft: 5,
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
  },
  fullScreenModalCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  fullScreenContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
  },
  fullScreenInfo: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 10,
    width: '100%',
  },
  fullScreenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  fullScreenRelation: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  fullScreenBirthday: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  fullScreenDescription: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  fullScreenTags: {
    fontSize: 16,
    color: '#333',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005BBB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginTop: 20,
  },
  speakButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  videoFullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFullScreen: {
    width: '100%',
    height: '80%',
  },
  videoFullScreenCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  expandButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
});

export default MemoriesScreen;