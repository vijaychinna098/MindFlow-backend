import React, { useState, useEffect, useRef } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  ActivityIndicator,
  Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Animated values for transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const optionAnim = useRef(new Animated.Value(0)).current;

  // For testing: clear the flag so welcome always shows on reload (remove for production)
  useEffect(() => {
    AsyncStorage.removeItem('hasSeenWelcome')
      .then(() => console.log('Welcome flag cleared for testing'))
      .catch(error => console.error('Error clearing welcome flag:', error));
  }, []);

  // Check if the welcome screen has been seen already
  useEffect(() => {
    const checkWelcomeStatus = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        console.log("hasSeenWelcome:", hasSeenWelcome);
        if (hasSeenWelcome) {
          navigation.replace('Login');
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking welcome status:', error);
        setIsLoading(false);
      }
    };

    checkWelcomeStatus();
  }, [navigation]);

  const handleGetStarted = () => {
    // Animate fade-out of current content
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      // After fade-out, show options and animate them in
      setShowOptions(true);
      Animated.timing(optionAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleOptionSelect = async (option) => {
    try {
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
      if (option === 'user') {
        navigation.replace('Login');
      } else if (option === 'caregiver') {
        navigation.replace('CaregiverLogin');
      }
    } catch (error) {
      console.error('Error setting welcome status:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#005BBB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!showOptions ? (
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Image 
            source={require('../images/welcome.png')} 
            style={styles.image} 
          /> 
          <Text style={styles.title}>Welcome to MindFlow</Text>
          <Text style={styles.subtitle}>
            Your companion for care and memory support.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.optionsWrapper, { opacity: optionAnim }]}>
          {/* New image and descriptive text */}
          <Image 
            source={require('../images/user.jpg')} 
            style={styles.transitionImage} 
          />
          <Text style={styles.description}>
            Choose your mode:
          </Text>
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={[styles.optionButton, { backgroundColor: '#005BBB' }]}
              onPress={() => handleOptionSelect('user')}
            >
              <Text style={styles.optionText}>User</Text>
              <Text style={styles.optionDesc}>
                For patients, providing simple and friendly features.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.optionButton, { backgroundColor: '#D9534F' }]}
              onPress={() => handleOptionSelect('caregiver')}
            >
              <Text style={styles.optionText}>Caregiver</Text>
              <Text style={styles.optionDesc}>
                For caregivers, with advanced settings to manage care.
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F0F4F8', 
    padding: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  content: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  image: { 
    width: 300, 
    height: 300, 
    resizeMode: 'contain', 
    marginBottom: 20 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#005BBB', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 18, 
    color: '#2C3E50', 
    textAlign: 'center', 
    marginBottom: 30 
  },
  button: { 
    backgroundColor: '#005BBB', 
    paddingVertical: 15, 
    paddingHorizontal: 40, 
    borderRadius: 30 
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  optionsWrapper: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  transitionImage: {
    width: 250,
    height: 250,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  description: {
    fontSize: 22,
    color: '#005BBB',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    width: '100%',
  },
  optionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginVertical: 10,
    alignItems: 'center',
  },
  optionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  optionDesc: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
});

export default WelcomeScreen;
