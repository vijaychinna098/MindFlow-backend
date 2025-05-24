import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView,
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const HowToUseScreen = ({ route }) => {
  const navigation = useNavigation();
  
  // Check if user is coming from caregiver settings or user settings
  const isCaregiver = route.params?.isCaregiver || false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How to Use MindFlow</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Image 
            source={require('../../assets/images/MindFlow.jpg')} 
            style={styles.appLogo}
            resizeMode="contain"
          />
          
          <Text style={styles.sectionTitle}>Welcome to MindFlow</Text>
          
          <Text style={styles.paragraph}>
            MindFlow is designed to support individuals with Alzheimer's disease and their caregivers. 
            The app provides daily task management, memory aids, location services, and cognitive activities 
            to improve quality of life and promote independence.
          </Text>
          
          <Text style={styles.sectionTitle}>Getting Started</Text>
          
          <Text style={styles.paragraph}>
            To get started with MindFlow, create your account and complete your profile. 
            {isCaregiver 
              ? " As a caregiver, connect with your patient using their email address through the 'Connect to Patient' option in Settings. Once connected, you'll be able to manage their reminders, memories, and monitor their activities."
              : " Your caregiver will send you a connection request that you'll need to accept. This allows them to help manage your reminders and provide support remotely."
            }
          </Text>
          
          <Text style={styles.sectionTitle}>Main Features</Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Home Screen:</Text> This is your starting point, showing today's tasks, 
            daily health tips, and quick access to all features. The four main feature cards provide 
            access to Reminders, Memories, Safe Places, and Family contacts.
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Reminders:</Text> {isCaregiver 
              ? "Create and manage daily tasks and medication schedules for your patient. Set specific times and recurrence patterns to help them stay on track."
              : "View your daily tasks and medication schedules. Mark tasks as completed once you've finished them."
            }
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Memories:</Text> {isCaregiver 
              ? "Create a digital memory book with photos and descriptions of people, places, and events important to your patient. This helps strengthen recognition and recall."
              : "Browse through photos and descriptions of people, places, and events in your life to strengthen recognition and recall."
            }
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Safe Places:</Text> {isCaregiver 
              ? "Set up and monitor important locations like home, doctor's office, and family homes. You can track your patient's location and receive alerts if they leave designated safe areas."
              : "View important locations on the map and get directions when needed. The app can help you navigate to familiar places if you feel lost."
            }
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Family:</Text> {isCaregiver 
              ? "Manage contact information for family members and other important people in your patient's life. Add photos to help with recognition."
              : "Access contact information for your family members and other important people in your life. Photos help with recognition."
            }
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Activities:</Text> {isCaregiver 
              ? "Monitor your patient's engagement with memory games and cognitive exercises designed to maintain mental function."
              : "Access games and exercises designed to maintain mental function, including matching pairs, word memory, puzzles, and other activities."
            }
          </Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Emergency Support:</Text> The emergency button is available from the 
            bottom navigation bar for quick access to emergency contacts. {isCaregiver 
              ? "Set up and prioritize emergency contacts for your patient."
              : "Tap this to quickly call for help or share your location with caregivers."
            }
          </Text>
          
          <Text style={styles.sectionTitle}>Daily Usage Tips</Text>
          
          <Text style={styles.paragraph}>
            • Check the Home screen daily to see upcoming tasks and reminders
          </Text>
          
          <Text style={styles.paragraph}>
            • Keep your phone charged when going out so safety features work properly
          </Text>
          
          <Text style={styles.paragraph}>
            • Enable location services for navigation and safety features
          </Text>
          
          <Text style={styles.paragraph}>
            • Review your Memories section regularly to strengthen recall
          </Text>
          
          <Text style={styles.paragraph}>
            • Try to complete at least one cognitive activity daily
          </Text>
          
          <Text style={styles.paragraph}>
            • Use the voice assistance feature in Settings if reading text is difficult
          </Text>
          
          <Text style={styles.paragraph}>
            • Adjust font size as needed in Settings
          </Text>
          
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          
          <Text style={styles.paragraph}>
            If you experience issues with the app:
          </Text>
          
          <Text style={styles.paragraph}>
            • Ensure you have a stable internet connection
          </Text>
          
          <Text style={styles.paragraph}>
            • Check that all permissions are enabled (notifications, location)
          </Text>
          
          <Text style={styles.paragraph}>
            • Restart the app if it's unresponsive
          </Text>
          
          <Text style={styles.paragraph}>
            • Verify that reminders are enabled in Settings
          </Text>
          
          <Text style={styles.paragraph}>
            • Contact support at vijaychinna098@gmail.com if problems persist
          </Text>
          
          <Text style={styles.sectionTitle}>Getting Help</Text>
          
          <Text style={styles.paragraph}>
            This guide is always available from the Settings screen. You can also review 
            our Privacy Policy to understand how your data is protected.
          </Text>
          
          <Text style={styles.paragraph}>
            {isCaregiver 
              ? "As a caregiver, you play a vital role in helping your patient use MindFlow effectively. Regular communication about the app's features will improve their experience."
              : "Don't hesitate to contact your caregiver if you have any questions about using the app."
            }
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  appLogo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005BBB',
    marginTop: 16,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 12,
  },
  bold: {
    fontWeight: 'bold',
  },
});

export default HowToUseScreen;