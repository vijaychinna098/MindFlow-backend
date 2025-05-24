import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native-gesture-handler';

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>MindFlow Privacy Policy</Text>
          <Text style={styles.date}>Last Updated: May 5, 2025</Text>
          
          <Text style={styles.paragraph}>
            This Privacy Policy describes how MindFlow ("we," "us," or "our") collects, uses, and shares information in connection with your use of the MindFlow application (the "App"), designed to support individuals with Alzheimer's disease and their caregivers.
          </Text>
          
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We understand the sensitive nature of the information related to individuals with Alzheimer's disease. We are committed to protecting your privacy. The information we collect depends on how you and the caregiver use the App.
          </Text>
          
          <Text style={styles.subsectionTitle}>a. Information Provided by the Caregiver:</Text>
          <Text style={styles.bulletPoint}>• Account Information: When a caregiver creates an account, we may collect their name, email address, and password.</Text>
          <Text style={styles.bulletPoint}>• Patient Profile Information: To personalize the App experience for the patient, the caregiver may provide information such as the patient's name, age, interests, familiar faces, important dates, and potentially photos and audio recordings. We emphasize that the caregiver is responsible for obtaining any necessary consent before inputting this information.</Text>
          <Text style={styles.bulletPoint}>• Reminders and Schedules: Caregivers may input reminders for medication, appointments, and daily tasks.</Text>
          <Text style={styles.bulletPoint}>• Memories and Personal Content: Caregivers may upload photos, videos, and audio recordings to the "Memories" section to help trigger recognition and engagement for the patient.</Text>
          <Text style={styles.bulletPoint}>• Family Contacts: Caregivers may add contact information for family members for communication features (if implemented).</Text>
          <Text style={styles.bulletPoint}>• Location Data (Optional): If location tracking features are enabled by the caregiver for safety purposes, we may collect the patient's device location. This feature will only be activated with explicit consent from the caregiver.</Text>
          
          <Text style={styles.subsectionTitle}>b. Information Collected Automatically:</Text>
          <Text style={styles.bulletPoint}>• App Usage Data: We may collect information about how the patient and caregiver interact with the App, such as the features used, the duration of use, and any errors encountered. This helps us improve the App's functionality and user experience.</Text>
          <Text style={styles.bulletPoint}>• Device Information: We may collect information about the device used to access the App, including the device model, operating system, and unique device identifiers.</Text>
          <Text style={styles.bulletPoint}>• Anonymous Analytics: We may use third-party analytics tools to collect anonymized and aggregated data about App usage trends. This data does not identify individual users.</Text>
          
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the collected information for the following purposes:
          </Text>
          <Text style={styles.bulletPoint}>• To Provide and Maintain the App: To ensure the App functions correctly and provide you with the features and services offered.</Text>
          <Text style={styles.bulletPoint}>• To Personalize the Patient Experience: To tailor the content, reminders, and games to the patient's specific needs and interests based on the information provided by the caregiver.</Text>
          <Text style={styles.bulletPoint}>• To Facilitate Reminders and Schedules: To deliver timely reminders for medication, appointments, and tasks.</Text>
          <Text style={styles.bulletPoint}>• To Support Memory Engagement: To display photos, videos, and play audio recordings in the "Memories" section to aid patient recognition and engagement.</Text>
          <Text style={styles.bulletPoint}>• To Enable Communication (if implemented): To facilitate communication between family members and caregivers.</Text>
          <Text style={styles.bulletPoint}>• To Ensure Safety (if location tracking is enabled): To allow caregivers to monitor the patient's location for safety purposes.</Text>
          <Text style={styles.bulletPoint}>• To Improve the App: To analyze App usage data and user feedback to identify areas for improvement and develop new features.</Text>
          <Text style={styles.bulletPoint}>• To Provide Support: To respond to caregiver inquiries and provide technical assistance.</Text>
          <Text style={styles.bulletPoint}>• For Research and Development (using anonymized data): To conduct research and development to improve our understanding of Alzheimer's care and enhance the App's effectiveness, using only anonymized and aggregated data.</Text>
          
          <Text style={styles.sectionTitle}>3. Sharing Your Information</Text>
          <Text style={styles.paragraph}>
            We understand the sensitivity of this information and will only share it in limited circumstances:
          </Text>
          <Text style={styles.bulletPoint}>• With Caregivers and Designated Family Members: Information related to the patient's profile, reminders, memories, and location data (if enabled) will be accessible to the designated caregiver(s) and family members authorized by the primary caregiver within the App.</Text>
          <Text style={styles.bulletPoint}>• With Service Providers: We may share anonymized and aggregated data with third-party service providers who assist us with analytics, data analysis, and App improvement. These providers are contractually obligated to protect your information and use it only for the purposes we specify.</Text>
          <Text style={styles.bulletPoint}>• For Legal Compliance: We may disclose your information if required to do so by law, court order, or other legal process.</Text>
          <Text style={styles.bulletPoint}>• In Case of Business Transfer: In the event of a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred to the acquiring entity. You will be notified via email and/or a prominent notice on our App of any change in ownership or uses of your personal information, as well as any choices you may have regarding your personal information.</Text>
          <Text style={styles.paragraph}>
            We will NOT sell, rent, or otherwise disclose your personal information, including patient-specific data, to third parties for their marketing purposes.
          </Text>
          
          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We take reasonable measures to protect the information collected through the App from unauthorized access, use, disclosure, alteration, or destruction. These measures include:
          </Text>
          <Text style={styles.bulletPoint}>• Encryption of sensitive data during transmission.</Text>
          <Text style={styles.bulletPoint}>• Secure storage of data on our servers.</Text>
          <Text style={styles.bulletPoint}>• Regular security assessments and updates.</Text>
          <Text style={styles.bulletPoint}>• Limiting access to personal information to authorized personnel only.</Text>
          <Text style={styles.paragraph}>
            However, no method of transmission over the internet or method of electronic storage is completely secure. Therefore, while we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
          </Text>
          
          <Text style={styles.sectionTitle}>5. Data Retention</Text>
          <Text style={styles.paragraph}>
            We will retain your information for as long as your account is active or as needed to provide you with the services. We will also retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements. Caregivers can delete patient-specific information and their account at any time through the App settings. Upon account deletion, we will take reasonable steps to securely delete your personal information from our active systems. Anonymized and aggregated data may be retained for analytical purposes.
          </Text>
          
          <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            The App is not directly targeted towards children under the age of 13. We do not knowingly collect personal information from children under 13. If a caregiver provides information about a patient who is under 13, the caregiver warrants that they have the necessary legal authority to do so. If we become aware that we have collected personal information from a child under 13 without verifiable parental consent, we will take steps to delete that information.
          </Text>
          
          <Text style={styles.sectionTitle}>7. Your Rights (Caregiver)</Text>
          <Text style={styles.paragraph}>
            As a caregiver, you have certain rights regarding the personal information you provide and the patient's information you input:
          </Text>
          <Text style={styles.bulletPoint}>• Access: You have the right to access the information we hold about you and the patient.</Text>
          <Text style={styles.bulletPoint}>• Correction: You have the right to request that we correct any inaccurate or incomplete information.</Text>
          <Text style={styles.bulletPoint}>• Deletion: You have the right to request the deletion of your account and the patient's information.</Text>
          <Text style={styles.bulletPoint}>• Objection to Processing: You may have the right to object to certain processing of your information.</Text>
          <Text style={styles.bulletPoint}>• Data Portability: You may have the right to receive a copy of your personal information in a structured, commonly used, and machine-readable format.</Text>
          <Text style={styles.paragraph}>
            To exercise these rights, please contact us using the contact information provided below. We will respond to your request within a reasonable timeframe.
          </Text>
          
          <Text style={styles.sectionTitle}>8. Changes to This Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on the App and/or by sending you an email (if you have provided your email address). We encourage you to review this Privacy Policy periodically for any updates or changes. Your continued use of the App after the posting of a revised Privacy Policy signifies your acceptance of the changes.
          </Text>
          
          <Text style={styles.sectionTitle}>9. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions or concerns about this Privacy Policy or our privacy practices regarding the MindFlow App, please contact us at:
          </Text>
          <Text style={styles.bulletPoint}>Email: vijaychinna098@gmail.com</Text>
          
          <Text style={styles.paragraph} style={styles.disclaimerText}>
            By using the MindFlow App, you acknowledge that you have read, understood, and agree to the terms of this Privacy Policy.
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 8,
    paddingLeft: 16,
  },
  disclaimerText: {
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 30,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default PrivacyPolicyScreen;