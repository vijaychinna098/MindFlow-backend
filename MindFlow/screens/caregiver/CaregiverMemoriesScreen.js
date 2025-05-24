import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCaregiver } from '../../CaregiverContext';
import { useMemories } from "../../context/MemoriesContext";
import { useFontSize } from "./CaregiverFontSizeContext";
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';

const relationTranslations = {
  en: { son: "son", daughter: "daughter", father: "father", mother: "mother" },
  hi: { son: "बेटा", daughter: "बेटी", father: "पिता", mother: "माता" },
  te: { son: "కొడుకు", daughter: "కుమార్తె", father: "తండ్రి", mother: "తల్లి" },
  es: { son: "hijo", daughter: "hija", father: "padre", mother: "madre" },
};

const translateText = (text, lang) => text;

const translations = {
  en: {
    relation: "Relation",
    description: "Description",
    birthday: "Birthday",
    tags: "Tags",
    dear: "Dear",
    addNewMemory: "Add New Memory",
    selectBirthday: "Select Birthday",
    uploadPhoto: "Upload Photo",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    memories: "Memories",
    noMemories: "No memories available.",
  },
  hi: {
    relation: "रिश्ता",
    description: "विवरण",
    birthday: "जन्मदिन",
    tags: "टैग्स",
    dear: "प्रिय",
    addNewMemory: "नई स्मृति जोड़ें",
    selectBirthday: "जन्मदिन चुनें",
    uploadPhoto: "फोटो अपलोड करें",
    cancel: "रद्द करें",
    save: "सहेजें",
    add: "जोड़ें",
    memories: "स्मृतियाँ",
    noMemories: "कोई स्मृतियाँ उपलब्ध नहीं हैं।",
  },
  te: {
    relation: "సంబంధం",
    description: "వివరణ",
    birthday: "జన్మదినం",
    tags: "ట్యాగ్స్",
    dear: "ప్రియమైన",
    addNewMemory: "కొత్త జ్ఞాపకం జోడించండి",
    selectBirthday: "పుట్టినరోజు ఎంచుకోండి",
    uploadPhoto: "ఫోటోను అప్‌లోడ్ చేయండి",
    cancel: "రద్దు చేయండి",
    save: "సేవ్ చేయండి",
    add: "జోడించండి",
    memories: "జ్ఞాపకాలు",
    noMemories: "జ్ఞాపకాలు లేవు.",
  },
  es: {
    relation: "Relación",
    description: "Descripción",
    birthday: "Cumpleaños",
    tags: "Etiquetas",
    dear: "Estimado",
    addNewMemory: "Agregar nuevo recuerdo",
    selectBirthday: "Seleccionar cumpleaños",
    uploadPhoto: "Subir foto",
    cancel: "Cancelar",
    save: "Guardar",
    add: "Agregar",
    memories: "Recuerdos",
    noMemories: "No hay recuerdos disponibles.",
  },
};

const enhancedTranslations = {
  en: {
    ...translations.en,
    uploadMedia: "Upload Media",
    uploadPhoto: "Upload Photo",
    uploadVideo: "Upload Video",
    chooseMediaType: "Choose Media Type",
    photo: "Photo",
    video: "Video"
  },
  hi: {
    ...translations.hi,
    uploadMedia: "मीडिया अपलोड करें",
    uploadPhoto: "फोटो अपलोड करें",
    uploadVideo: "वीडियो अपलोड करें",
    chooseMediaType: "मीडिया प्रकार चुनें",
    photo: "फोटो",
    video: "वीडियो"
  },
  te: {
    ...translations.te,
    uploadMedia: "మీడియాను అప్‌లోడ్ చేయండి",
    uploadPhoto: "ఫోటోను అప్‌లోడ్ చేయండి",
    uploadVideo: "వీడియోను అప్‌లోడ్ చేయండి",
    chooseMediaType: "మీడియా రకాన్ని ఎంచుకోండి",
    photo: "ఫోటో",
    video: "వీడియో"
  },
  es: {
    ...translations.es,
    uploadMedia: "Subir Medios",
    uploadPhoto: "Subir Foto",
    uploadVideo: "Subir Video",
    chooseMediaType: "Elegir Tipo de Medio",
    photo: "Foto",
    video: "Video"
  }
};

const CaregiverMemoriesScreen = () => {
  const navigation = useNavigation();
  const { caregiver, activePatient } = useCaregiver();
  const { memories, setMemories } = useMemories();
  const { fontSize } = useFontSize();
  const [localMemories, setLocalMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPatientId, setCurrentPatientId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [isFullScreenModalVisible, setIsFullScreenModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [newMemory, setNewMemory] = useState({
    title: '',
    relation: '',
    gender: '',
    description: '',
    birthday: '',
    tags: '',
    image: '',
    video: '',
    mediaType: '',
  });
  const [language, setLanguage] = useState('en');
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  // Use multiple video refs instead of a single shared ref
  const cardVideoRefs = useRef({});
  const previewVideoRef = useRef(null);
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

  useEffect(() => {
    if (activePatient) {
      loadMemoriesFromStorage();
    }
  }, [activePatient]);

  useEffect(() => {
    if (Array.isArray(memories) && memories.length > 0 && activePatient?.email?.toLowerCase().trim() === currentPatientId) {
      setLocalMemories(memories);
    }
  }, [memories, currentPatientId]);

  const loadMemoriesFromStorage = async () => {
    try {
      setIsLoading(true);
      if (!activePatient || !activePatient.email) {
        setLocalMemories([]);
        return;
      }
      const patientId = activePatient.email.toLowerCase().trim();
      setCurrentPatientId(patientId);
      const patientKey = `memories_${patientId}`;
      const stored = await AsyncStorage.getItem(patientKey);
      if (stored) {
        const parsedMemories = JSON.parse(stored);
        const validMemories = parsedMemories.filter(memory => memory.forPatient.toLowerCase().trim() === patientId);
        setLocalMemories(validMemories);
        setMemories(validMemories);
      } else {
        setLocalMemories([]);
      }
    } catch (error) {
      console.error("Error loading memories from storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMemoriesToPatient = async (memories) => {
    try {
      if (!activePatient?.email) return;
      const patientEmail = activePatient.email.toLowerCase().trim();
      const patientStorageKey = `memories_${patientEmail}`;
      const patientMemories = memories.map(memory => ({
        ...memory,
        forPatient: patientEmail
      }));
      await AsyncStorage.setItem(patientStorageKey, JSON.stringify(patientMemories));
      await AsyncStorage.setItem(`memory_mapping_${patientEmail}`, caregiver?.email || "");
    } catch (error) {
      console.error("Failed to save memories to patient storage:", error);
    }
  };

  const handleDeleteMemory = (memoryId) => {
    Alert.alert(
      "Delete Memory",
      "Are you sure you want to delete this memory?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            setIsLoading(true);
            const updatedMemories = localMemories.filter(memory => memory.id !== memoryId);
            setLocalMemories(updatedMemories);
            await saveMemoriesToPatient(updatedMemories);
            setIsLoading(false);
          }
        },
      ]
    );
  };

  const handleSaveMemory = () => {
    const { title, description, birthday } = newMemory;
    if (!title || !description || !birthday) {
      Alert.alert('Missing Fields', 'Please fill in title, description, and birthday');
      return;
    }
    if (!activePatient) {
      Alert.alert('No Patient Selected', 'Please select a patient before adding a memory.');
      return;
    }
    setIsLoading(true);
    const relLower = newMemory.relation.toLowerCase();
    const translatedRelation = relationTranslations[language] && relationTranslations[language][relLower]
      ? relationTranslations[language][relLower]
      : newMemory.relation;
    const translatedDescription = translateText(newMemory.description, language);
    if (isEditing) {
      const updatedMemories = localMemories.map(memory =>
        memory.id === editingMemoryId
          ? { 
              ...newMemory, 
              relation: translatedRelation, 
              description: translatedDescription, 
              id: editingMemoryId,
              forPatient: activePatient.email.toLowerCase().trim(),
              updatedAt: new Date().toISOString() 
            }
          : memory
      );
      setLocalMemories(updatedMemories);
      saveMemoriesToPatient(updatedMemories);
      setIsEditing(false);
      setEditingMemoryId(null);
    } else {
      const memoryToAdd = {
        ...newMemory,
        relation: translatedRelation,
        description: translatedDescription,
        id: Date.now().toString(),
        forPatient: activePatient.email.toLowerCase().trim(),
        createdBy: caregiver.email,
        createdAt: new Date().toISOString()
      };
      const updatedMemories = [...localMemories, memoryToAdd];
      setLocalMemories(updatedMemories);
      saveMemoriesToPatient(updatedMemories);
    }
    setNewMemory({
      title: '',
      relation: '',
      gender: '',
      description: '',
      birthday: '',
      tags: '',
      image: '',
      video: '',
      mediaType: '',
    });
    setIsModalVisible(false);
    setIsLoading(false);
  };

  const handleUploadPhoto = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Permission to access gallery was denied');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewMemory({ ...newMemory, image: result.assets[0].uri, mediaType: 'image' });
    }
  };

  const handleUploadVideo = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Permission to access gallery was denied');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewMemory({ ...newMemory, video: result.assets[0].uri, mediaType: 'video' });
    }
  };

  const handleOpenMemory = (memory) => {
    setSelectedMemory(memory);
    setIsFullScreenModalVisible(true);
    
    // Construct a message to read out
    const relationText = memory.relation ? `${memory.relation}` : '';
    
    let message = '';
    if (memory.gender && memory.gender.toLowerCase() === 'female') {
      message = `${translations[language].dear || 'Dear'} ${activePatient?.name || 'Patient'}, she is your ${relationText}. Her name is ${memory.title}. ${memory.description} Her birthday is on ${memory.birthday}.`;
    } else {
      message = `${translations[language].dear || 'Dear'} ${activePatient?.name || 'Patient'}, he is your ${relationText}. His name is ${memory.title}. ${memory.description} His birthday is on ${memory.birthday}.`;
    }
    
    if (voiceAssistanceEnabled) {
      Speech.speak(message, { language, rate: 0.8 });
    }
  };

  const handleEditMemory = (memory) => {
    setIsEditing(true);
    setEditingMemoryId(memory.id);
    setNewMemory({
      title: memory.title,
      relation: memory.relation,
      gender: memory.gender,
      description: memory.description,
      birthday: memory.birthday,
      tags: memory.tags || '',
      image: memory.image || '',
      video: memory.video || '',
      mediaType: memory.mediaType || '',
    });
    setIsModalVisible(true);
  };

  // Function to handle video playback status changes
  const handleVideoPlaybackStatusUpdate = (status) => {
    if (status.isPlaying) {
      // Video is playing, stop voice assistance
      Speech.stop();
      setIsVideoPlaying(true);
    } else {
      setIsVideoPlaying(false);
    }
  };

  const renderMemoryCard = ({ item }) => {
    return (
      <View style={styles.memoryCardContainer}>
        <TouchableOpacity style={styles.memoryCard} onPress={() => handleOpenMemory(item)}>
          {item.mediaType === 'image' && item.image ? (
            <Image source={{ uri: item.image }} style={styles.memoryImage} />
          ) : item.mediaType === 'video' && item.video ? (
            <Video
              ref={(ref) => (cardVideoRefs.current[item.id] = ref)}
              source={{ uri: item.video }}
              style={styles.memoryImage}
              useNativeControls
              resizeMode="contain"
              onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
              onError={(error) => {
                console.error(`Video playback error for memory ${item.id}:`, error);
              }}
            />
          ) : (
            <View style={[styles.memoryImage, styles.imagePlaceholder]}>
              <Text style={[styles.placeholderText, { fontSize }]}>No Media</Text>
            </View>
          )}
          <Text style={[styles.memoryTitle, { fontSize }]}>{item.title}</Text>
          <Text style={[styles.memoryRelation, { fontSize: fontSize - 2 }]}>{translations[language].relation}: {item.relation}</Text>
          <Text style={[styles.memoryDescription, { fontSize: fontSize - 2 }]}>{translations[language].description}: {item.description}</Text>
          <Text style={[styles.memoryBirthday, { fontSize: fontSize - 2 }]}>{translations[language].birthday}: {item.birthday}</Text>
          {item.tags ? (
            <Text style={[styles.memoryTags, { fontSize: fontSize - 2 }]}>{translations[language].tags}: {item.tags}</Text>
          ) : null}
        </TouchableOpacity>
        <View style={styles.cardButtons}>
          <TouchableOpacity onPress={() => handleEditMemory(item)} style={styles.editButton}>
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              Speech.stop();
              // Unload video before deleting to prevent thread issues
              if (item.mediaType === 'video' && cardVideoRefs.current[item.id]) {
                try {
                  cardVideoRefs.current[item.id].unloadAsync();
                } catch (error) {
                  console.log("Error unloading video:", error);
                }
              }
              handleDeleteMemory(item.id);
            }} 
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const showDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  const handleConfirmDate = (date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setNewMemory({ ...newMemory, birthday: formattedDate });
    setIsDatePickerVisible(false);
  };

  const handleCancelDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { fontSize: fontSize + 8 }]}>{translations[language].memories}</Text>
      
      {!activePatient ? (
        <View style={styles.noPatientContainer}>
          <Ionicons name="person-outline" size={50} color="#005BBB" style={styles.noPatientIcon} />
          <Text style={[styles.noPatientText, { fontSize: fontSize + 2 }]}>No patient connected</Text>
          <Text style={[styles.noPatientSubText, { fontSize }]}>Please connect and select an active patient from the Patients screen to manage memories.</Text>
          <TouchableOpacity 
            style={styles.connectPatientButton}
            onPress={() => navigation.navigate("CaregiverPatients")}
          >
            <Text style={[styles.connectPatientButtonText, { fontSize }]}>Connect Patient</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#005BBB" />
          <Text style={[styles.loaderText, { fontSize: fontSize + 2 }]}>Loading memories...</Text>
        </View>
      ) : localMemories.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={[styles.emptyText, { fontSize }]}>{translations[language].noMemories}</Text>
          {activePatient && (
            <Text style={[styles.subText, { fontSize: fontSize - 2 }]}>
              Memories you add here will be visible to {activePatient.name || activePatient.email}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={localMemories}
          renderItem={renderMemoryCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.memoriesList}
          refreshing={isLoading}
          onRefresh={loadMemoriesFromStorage}
        />
      )}
      
      <TouchableOpacity 
        style={[styles.addButton, !activePatient && styles.disabledButton]} 
        onPress={() => {
          if (!activePatient) {
            Alert.alert('No Patient Connected', 'Please connect and select an active patient before adding memories.');
            return;
          }
          setIsModalVisible(true);
          setIsEditing(false);
          setEditingMemoryId(null);
          setNewMemory({
            title: '',
            relation: '',
            gender: '',
            description: '',
            birthday: '',
            tags: '',
            image: '',
            video: '',
            mediaType: '',
          });
        }}
      >
        <Text style={[styles.addButtonText, { fontSize }]}>
          {activePatient 
            ? `${translations[language].addNewMemory} for ${activePatient.name || activePatient.email}` 
            : translations[language].addNewMemory}
        </Text>
      </TouchableOpacity>
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? "Edit Memory" : "Add New Memory"}</Text>
            <TextInput
              placeholder="Title"
              style={styles.input}
              value={newMemory.title}
              onChangeText={(text) => setNewMemory({ ...newMemory, title: text })}
            />
            <TextInput
              placeholder="Relation (e.g., Son, Wife)"
              style={styles.input}
              value={newMemory.relation}
              onChangeText={(text) => setNewMemory({ ...newMemory, relation: text })}
            />
            <View style={styles.genderContainer}>
              <Text style={styles.genderLabel}>Gender:</Text>
              <Picker
                selectedValue={newMemory.gender}
                style={[styles.genderPicker, { color: '#2C3E50' }]}
                dropdownIconColor="#2C3E50"
                onValueChange={(itemValue) => setNewMemory({ ...newMemory, gender: itemValue })}
              >
                <Picker.Item label="Select" value="" />
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
              </Picker>
            </View>
            <TextInput
              placeholder="Description"
              style={styles.input}
              value={newMemory.description}
              onChangeText={(text) => setNewMemory({ ...newMemory, description: text })}
            />
            <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
              <Text style={styles.dateButtonText}>
                {newMemory.birthday ? `Birthday: ${newMemory.birthday}` : translations[language].selectBirthday}
              </Text>
            </TouchableOpacity>
            <TextInput
              placeholder="Tags (Optional)"
              style={styles.input}
              value={newMemory.tags}
              onChangeText={(text) => setNewMemory({ ...newMemory, tags: text })}
            />
            <View style={styles.mediaButtonsContainer}>
              <TouchableOpacity style={styles.photoButton} onPress={handleUploadPhoto}>
                <Text style={styles.photoButtonText}>{enhancedTranslations[language].uploadPhoto}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoButton} onPress={handleUploadVideo}>
                <Text style={styles.videoButtonText}>{enhancedTranslations[language].uploadVideo}</Text>
              </TouchableOpacity>
            </View>
            {newMemory.mediaType === 'image' && newMemory.image ? (
              <Image source={{ uri: newMemory.image }} style={styles.previewImage} />
            ) : newMemory.mediaType === 'video' && newMemory.video ? (
              <Video
                ref={previewVideoRef}
                source={{ uri: newMemory.video }}
                style={styles.previewImage}
                useNativeControls
                resizeMode="contain"
                onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
                onError={(error) => {
                  console.error("Video preview error:", error);
                }}
              />
            ) : null}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  // Unload video if there is one before closing modal
                  if (newMemory.mediaType === 'video' && previewVideoRef.current) {
                    try {
                      previewVideoRef.current.unloadAsync();
                    } catch (error) {
                      console.log("Error unloading preview video:", error);
                    }
                  }
                  
                  setIsModalVisible(false);
                  setNewMemory({
                    title: '',
                    relation: '',
                    gender: '',
                    description: '',
                    birthday: '',
                    tags: '',
                    image: '',
                    video: '',
                    mediaType: '',
                  });
                  setIsEditing(false);
                  setEditingMemoryId(null);
                }}
              >
                <Text style={styles.modalButtonText}>{translations[language].cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveMemory}>
                <Text style={styles.modalButtonText}>{isEditing ? translations[language].save : translations[language].add}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={isFullScreenModalVisible} animationType="fade" transparent>
        <View style={styles.fullScreenOverlay}>
          <View style={styles.fullScreenContainer}>
            {selectedMemory && (
              <>
                {selectedMemory.mediaType === 'image' && selectedMemory.image ? (
                  <Image source={{ uri: selectedMemory.image }} style={styles.fullScreenImage} />
                ) : selectedMemory.mediaType === 'video' && selectedMemory.video ? (
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
                ) : (
                  <View style={[styles.fullScreenImage, styles.imagePlaceholder]}>
                    <Text style={[styles.placeholderText, { fontSize }]}>No Media</Text>
                  </View>
                )}
                <Text style={styles.fullScreenTitle}>{selectedMemory.title}</Text>
                <Text style={styles.fullScreenRelation}>{translations[language].relation}: {selectedMemory.relation}</Text>
                <Text style={styles.fullScreenGender}>
                  {selectedMemory.gender === 'male' ? 'He' : selectedMemory.gender === 'female' ? 'She' : ''} is your {selectedMemory.relation}
                </Text>
                <Text style={styles.fullScreenDescription}>{translations[language].description}: {selectedMemory.description}</Text>
                <Text style={styles.fullScreenBirthday}>{translations[language].birthday}: {selectedMemory.birthday}</Text>
                {selectedMemory.tags ? (
                  <Text style={styles.fullScreenTags}>{translations[language].tags}: {selectedMemory.tags}</Text>
                ) : null}
              </>
            )}
            <TouchableOpacity 
              style={styles.fullScreenCloseButton} 
              onPress={() => {
                Speech.stop();
                // Unload video if present before closing modal
                if (selectedMemory?.mediaType === 'video' && fullscreenVideoRef.current) {
                  try {
                    fullscreenVideoRef.current.unloadAsync();
                  } catch (error) {
                    console.log("Error unloading fullscreen video:", error);
                  }
                }
                setIsFullScreenModalVisible(false);
              }}
            >
              <Ionicons name="close-circle" size={40} color="black" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={handleCancelDatePicker}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', paddingTop: 40, paddingHorizontal: 10 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#005BBB', textAlign: 'center', marginBottom: 15 },
  languageContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  languageLabel: { fontSize: 16, color: '#2C3E50', marginRight: 10 },
  picker: { width: 150, height: 55 },
  memoriesList: { paddingBottom: 20 },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 16, marginTop: 20 },
  memoryCardContainer: { width: '48%', margin: 5 },
  memoryCard: { backgroundColor: '#fff', borderRadius: 10, padding: 10, elevation: 2 },
  memoryImage: { width: '100%', height: 200, borderRadius: 10 },
  imagePlaceholder: { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 18, color: '#555' },
  memoryTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginTop: 10 },
  memoryRelation: { fontSize: 16, color: '#005BBB', marginTop: 2 },
  memoryDescription: { fontSize: 16, color: '#2C3E50', marginTop: 5 },
  memoryBirthday: { fontSize: 14, color: '#777', marginTop: 5 },
  memoryTags: { fontSize: 14, color: '#005BBB', marginTop: 5 },
  cardButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  editButton: { backgroundColor: "#005BBB", padding: 8, borderRadius: 20 },
  deleteButton: { backgroundColor: "#D9534F", padding: 8, borderRadius: 20 },
  addButton: { backgroundColor: '#005BBB', padding: 15, borderRadius: 10, alignItems: 'center', marginVertical: 15 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#fff', margin: 20, borderRadius: 10, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#F0F4F8', borderRadius: 5, padding: 10, marginVertical: 5 },
  genderContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  genderLabel: { fontSize: 16, marginRight: 10 },
  genderPicker: { width: 120, height: 40 },
  dateButton: { backgroundColor: '#005BBB', padding: 10, borderRadius: 5, marginVertical: 10 },
  dateButtonText: { color: '#fff', textAlign: 'center' },
  mediaButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  photoButton: { backgroundColor: '#005BBB', padding: 10, borderRadius: 5, flex: 1, marginRight: 5 },
  photoButtonText: { color: '#fff', textAlign: 'center' },
  videoButton: { backgroundColor: '#005BBB', padding: 10, borderRadius: 5, flex: 1, marginLeft: 5 },
  videoButtonText: { color: '#fff', textAlign: 'center' },
  previewImage: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center', marginVertical: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  modalButton: { padding: 10, borderRadius: 5, backgroundColor: '#005BBB', flex: 1, marginHorizontal: 5, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16 },
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  fullScreenContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 10, padding: 20, alignItems: 'center' },
  fullScreenImage: { width: '100%', height: 300, borderRadius: 10 },
  fullScreenTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  fullScreenRelation: { fontSize: 18, color: '#005BBB', marginTop: 5 },
  fullScreenGender: { fontSize: 16, marginTop: 5 },
  fullScreenDescription: { fontSize: 16, marginTop: 5 },
  fullScreenBirthday: { fontSize: 14, marginTop: 5 },
  fullScreenTags: { fontSize: 14, marginTop: 5 },
  fullScreenCloseButton: { position: 'absolute', top: 10, right: 10 },
  patientInfoBox: { 
    backgroundColor: "#E8F4FF", 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center" 
  },
  patientInfoText: { 
    fontSize: 14, 
    color: "#005BBB",
    flex: 1
  },
  patientIcon: {
    marginRight: 10
  },
  subText: { 
    fontSize: 14, 
    color: '#777', 
    textAlign: 'center',
    marginTop: 5 
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005BBB',
    marginTop: 10,
  },
  noPatientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPatientIcon: {
    marginBottom: 10,
  },
  noPatientText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  noPatientSubText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 5,
  },
  connectPatientButton: {
    backgroundColor: '#005BBB',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  connectPatientButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default CaregiverMemoriesScreen;