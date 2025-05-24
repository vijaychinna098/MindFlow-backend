import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Function to stop any ongoing speech
export const stopSpeech = () => {
  Speech.stop();
};

// Get the voice language setting from AsyncStorage
export const getVoiceLanguage = async () => {
  try {
    const storedVoiceLanguage = await AsyncStorage.getItem('voiceLanguage');
    return storedVoiceLanguage || 'en-US'; // Default to en-US if not set
  } catch (error) {
    console.error('Error retrieving voice language:', error);
    return 'en-US'; // Default to en-US if error
  }
};

// Get the app UI language from AsyncStorage
export const getAppLanguage = async () => {
  try {
    const storedLanguage = await AsyncStorage.getItem('language');
    return storedLanguage || 'en'; // Default to en if not set
  } catch (error) {
    console.error('Error retrieving app language:', error);
    return 'en'; // Default to en if error
  }
};

// Cache for translations to avoid repeated API calls for the same text
const translationCache = {};

// Save translations to AsyncStorage for offline access
const saveTranslationToCache = async (text, langCode, translation) => {
  try {
    const cacheKey = `${text}_${langCode}`;
    translationCache[cacheKey] = translation;
    
    // Get existing cache
    const cachedTranslations = await AsyncStorage.getItem('translationCache');
    const cache = cachedTranslations ? JSON.parse(cachedTranslations) : {};
    
    // Update cache
    cache[cacheKey] = {
      translation,
      timestamp: Date.now()
    };
    
    // Only store the most recent 500 translations to avoid storage limits
    const cacheEntries = Object.entries(cache);
    if (cacheEntries.length > 500) {
      // Sort by timestamp (oldest first)
      cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // Remove oldest entries to keep only 500
      const newCache = Object.fromEntries(cacheEntries.slice(cacheEntries.length - 500));
      await AsyncStorage.setItem('translationCache', JSON.stringify(newCache));
    } else {
      await AsyncStorage.setItem('translationCache', JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Error saving translation to cache:', error);
  }
};

// Load translations from AsyncStorage on app start
export const loadTranslationCache = async () => {
  try {
    const cachedTranslations = await AsyncStorage.getItem('translationCache');
    if (cachedTranslations) {
      const cache = JSON.parse(cachedTranslations);
      // Load only the translation text into the in-memory cache
      Object.entries(cache).forEach(([key, value]) => {
        translationCache[key] = value.translation;
      });
      console.log(`Loaded ${Object.keys(cache).length} cached translations`);
    }
  } catch (error) {
    console.error('Error loading translation cache:', error);
  }
};

// Call this function when the app starts
loadTranslationCache();

// Set this to your Google Translate API key
const GOOGLE_TRANSLATE_API_KEY = 'YOUR_GOOGLE_TRANSLATE_API_KEY';

// Direct translation using Google Cloud Translation API
const translateWithGoogleAPI = async (text, targetLanguage) => {
  // Skip translation if target language is English
  if (targetLanguage.startsWith('en')) {
    return text;
  }
  
  // Extract just language code from language tag (e.g., 'en-US' -> 'en')
  const langCode = targetLanguage.split('-')[0];
  
  // Check cache first
  const cacheKey = `${text}_${langCode}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        q: text,
        source: 'en',  // Source language is English
        target: langCode,  // Target language 
        format: 'text'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && 
        response.data.data && 
        response.data.data.translations && 
        response.data.data.translations.length > 0) {
      const translatedText = response.data.data.translations[0].translatedText;
      
      // Save to cache
      await saveTranslationToCache(text, langCode, translatedText);
      
      return translatedText;
    } else {
      console.error('Unexpected translation API response:', response.data);
      return text; // Return original text if translation failed
    }
  } catch (error) {
    console.error('Google Translation API error:', error);
    throw error; // Re-throw to try other methods
  }
};

// Alternative free translation using MyMemory API
const translateWithMyMemoryAPI = async (text, targetLanguage) => {
  // Skip translation if target language is English
  if (targetLanguage.startsWith('en')) {
    return text;
  }
  
  // Extract just language code from language tag (e.g., 'en-US' -> 'en')
  const langCode = targetLanguage.split('-')[0];
  
  // Check cache first
  const cacheKey = `${text}_${langCode}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    // MyMemory API - free with some limitations (no API key required for basic usage)
    const response = await axios.get(
      `https://api.mymemory.translated.net/get`,
      {
        params: {
          q: text,
          langpair: `en|${langCode}`,
          de: 'admin@alzheimerapp.com' // Add your email for higher limits
        },
        timeout: 5000 // 5 second timeout
      }
    );
    
    if (response.data && response.data.responseData && response.data.responseData.translatedText) {
      const translatedText = response.data.responseData.translatedText;
      
      // Save to cache
      await saveTranslationToCache(text, langCode, translatedText);
      
      return translatedText;
    } else {
      console.error('Unexpected MyMemory API response:', response.data);
      throw new Error('MyMemory translation failed');
    }
  } catch (error) {
    console.error('MyMemory API error:', error);
    throw error; // Re-throw to try other methods
  }
};

// Alternative translation using LibreTranslate (free and open source)
const translateWithLibreTranslate = async (text, targetLanguage) => {
  // Skip translation if target language is English
  if (targetLanguage.startsWith('en')) {
    return text;
  }
  
  // Extract just language code from language tag (e.g., 'en-US' -> 'en')
  const langCode = targetLanguage.split('-')[0];
  
  // Check cache first
  const cacheKey = `${text}_${langCode}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    // LibreTranslate public instances (you may need to change if these become unavailable)
    const libreTranslateInstances = [
      'https://translate.argosopentech.com',
      'https://libretranslate.de',
      'https://libretranslate.com'
    ];
    
    // Try each instance until one works
    let translatedText = text;
    let success = false;
    
    for (const instance of libreTranslateInstances) {
      if (success) break;
      
      try {
        const response = await axios.post(
          `${instance}/translate`,
          {
            q: text,
            source: 'en',
            target: langCode,
            format: 'text'
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 second timeout to prevent long waiting times
          }
        );
        
        if (response.data && response.data.translatedText) {
          translatedText = response.data.translatedText;
          success = true;
          
          // Save to cache
          await saveTranslationToCache(text, langCode, translatedText);
        }
      } catch (error) {
        console.log(`Failed with instance ${instance}:`, error.message);
        // Continue to next instance
      }
    }
    
    if (success) {
      return translatedText;
    } else {
      throw new Error('All LibreTranslate instances failed');
    }
  } catch (error) {
    console.error('LibreTranslate API error:', error);
    throw error; // Re-throw to try other methods
  }
};

// Translate text using local dictionaries (fallback method)
export const translateWithLocalDictionary = (text, langCode) => {
  // Common phrases and their translations in different languages
  const phraseTranslations = {
    'en': {
      // Common English phrases (no translation needed as this is the source language)
    },
    'es': { // Spanish translations
      'What is your name?': '¿Cómo te llamas?',
      'My name is': 'Me llamo',
      'How are you?': '¿Cómo estás?',
      'I am fine': 'Estoy bien',
      'Good morning': 'Buenos días',
      'Good afternoon': 'Buenas tardes',
      'Good evening': 'Buenas noches',
      'Welcome to Memory Games': 'Bienvenido a los Juegos de Memoria',
      'Welcome to Brain Training Activities': 'Bienvenido a Actividades de Entrenamiento Cerebral',
      'Voice instructions enabled': 'Instrucciones de voz habilitadas',
      'Correct, well done': 'Correcto, bien hecho',
      'Try again': 'Inténtalo de nuevo',
      'Level completed': 'Nivel completado',
      'Game over': 'Juego terminado',
      'Time\'s up': 'Se acabó el tiempo',
      'Choose a difficulty level': 'Elige un nivel de dificultad',
      'Choose a category': 'Elige una categoría',
      'You selected': 'Has seleccionado',
      'Remember these': 'Recuerda estos',
      'Now select the items in the correct order': 'Ahora selecciona los elementos en el orden correcto',
      'Congratulations': 'Felicidades',
      'Try again': 'Inténtalo de nuevo',
      'Your score': 'Tu puntuación',
      'Press Play to start': 'Presiona Jugar para comenzar',
      // Family related phrases
      'Hey': 'Hola',
      'he is': 'él es',
      'she is': 'ella es',
      'Phone number is': 'El número de teléfono es',
      'your': 'tu',
      // Memory activities related phrases
      'Let\'s try again': 'Intentemos de nuevo',
      'Memorize this word': 'Memoriza esta palabra',
      'Enter the word you just saw': 'Ingresa la palabra que acabas de ver',
      'Incorrect, try again': 'Incorrecto, intenta de nuevo',
      'Remember these objects': 'Recuerda estos objetos',
      'Now select all the objects you just saw': 'Ahora selecciona todos los objetos que acabas de ver',
      'You correctly remembered': 'Has recordado correctamente',
      'out of': 'de',
      'objects': 'objetos',
      'Watch the color sequence carefully': 'Observa cuidadosamente la secuencia de colores',
      'Now repeat the sequence': 'Ahora repite la secuencia',
      'Correct!': '¡Correcto!',
      'Opening': 'Abriendo',
      'Showing all memory games': 'Mostrando todos los juegos de memoria',
      'Showing beginner level memory games': 'Mostrando juegos de memoria de nivel principiante',
      'Showing intermediate level memory games': 'Mostrando juegos de memoria de nivel intermedio',
      'Showing advanced level memory games': 'Mostrando juegos de memoria de nivel avanzado',
      'Voice Assistance Disabled': 'Asistencia por voz desactivada',
      'Please enable Voice Assistance in Settings to use this feature': 'Por favor, activa la Asistencia por voz en Configuración para usar esta función',
      'Reminder': 'Recordatorio',
      'now it\'s time to': 'ahora es hora de',
      'the time is': 'la hora es',
    },
    'hi': { // Hindi translations
      'What is your name?': 'आपका नाम क्या है?',
      'My name is': 'मेरा नाम है',
      'How are you?': 'आप कैसे हैं?',
      'I am fine': 'मैं ठीक हूँ',
      'Good morning': 'सुप्रभात',
      'Good afternoon': 'नमस्कार',
      'Good evening': 'शुभ संध्या',
      'Welcome to Memory Games': 'मेमोरी गेम्स में आपका स्वागत है',
      'Welcome to Brain Training Activities': 'मस्तिष्क प्रशिक्षण गतिविधियों में आपका स्वागत है',
      'Voice instructions enabled': 'आवाज़ निर्देश सक्षम किए गए',
      'Correct, well done': 'सही, शाबाश',
      'Try again': 'फिर से प्रयास करें',
      'Level completed': 'स्तर पूरा हुआ',
      'Game over': 'खेल समाप्त',
      'Time\'s up': 'समय समाप्त',
      'Choose a difficulty level': 'कठिनाई स्तर चुनें',
      'Choose a category': 'एक श्रेणी चुनें',
      'You selected': 'आपने चुना',
      'Remember these': 'इन्हें याद रखें',
      'Now select the items in the correct order': 'अब सही क्रम में वस्तुओं का चयन करें',
      'Congratulations': 'बधाई हो',
      'Try again': 'फिर से प्रयास करें',
      'Your score': 'आपका स्कोर',
      'Press Play to start': 'शुरू करने के लिए प्ले दबाएं',
      // Family related phrases
      'Hey': 'अरे',
      'he is': 'वह है',
      'she is': 'वह है',
      'Phone number is': 'फोन नंबर है',
      'your': 'आपका',
      // Memory activities related phrases
      'Let\'s try again': 'फिर से कोशिश करें',
      'Memorize this word': 'इस शब्द को याद रखें',
      'Enter the word you just saw': 'वह शब्द दर्ज करें जो आपने अभी देखा',
      'Incorrect, try again': 'गलत, फिर से प्रयास करें',
      'Remember these objects': 'इन वस्तुओं को याद रखें',
      'Now select all the objects you just saw': 'अब उन सभी वस्तुओं का चयन करें जिन्हें आपने अभी देखा',
      'You correctly remembered': 'आपने सही याद रखा',
      'out of': 'में से',
      'objects': 'वस्तुएँ',
      'Watch the color sequence carefully': 'रंग अनुक्रम को ध्यान से देखें',
      'Now repeat the sequence': 'अब अनुक्रम दोहराएं',
      'Correct!': 'सही!',
      'Opening': 'खोल रहा है',
      'Showing all memory games': 'सभी मेमोरी गेम्स दिखा रहा है',
      'Showing beginner level memory games': 'शुरुआती स्तर के मेमोरी गेम्स दिखा रहा है',
      'Showing intermediate level memory games': 'मध्यम स्तर के मेमोरी गेम्स दिखा रहा है',
      'Showing advanced level memory games': 'उन्नत स्तर के मेमोरी गेम्स दिखा रहा है',
      'Voice Assistance Disabled': 'वॉयस असिस्टेंस अक्षम है',
      'Please enable Voice Assistance in Settings to use this feature': 'इस सुविधा का उपयोग करने के लिए कृपया सेटिंग्स में वॉयस असिस्टेंस को सक्षम करें',
      'Reminder': 'अनुस्मारक',
      'now it\'s time to': 'अब समय हो गया है',
      'the time is': 'समय है',
    },
    'te': { // Telugu translations
      'What is your name?': 'నీ పేరు ఏమిటి?',
      'My name is': 'నా పేరు',
      'How are you?': 'మీరు ఎలా ఉన్నారు?',
      'I am fine': 'నేను బాగున్నాను',
      'Good morning': 'శుభోదయం',
      'Good afternoon': 'శుభ మధ్యాహ్నం',
      'Good evening': 'శుభ సాయంత్రం',
      'Welcome to Memory Games': 'మెమరీ గేమ్స్‌కి స్వాగతం',
      'Welcome to Brain Training Activities': 'బ్రెయిన్ ట్రైనింగ్ కార్యకలాపాలకు స్వాగతం',
      'Voice instructions enabled': 'వాయిస్ సూచనలు ప్రారంభించబడ్డాయి',
      'Correct, well done': 'సరైనది, బాగా చేసారు',
      'Try again': 'మళ్ళీ ప్రయత్నించండి',
      'Level completed': 'లెవెల్ పూర్తయింది',
      'Game over': 'ఆట ముగిసింది',
      'Time\'s up': 'సమయం అయిపోయింది',
      'Choose a difficulty level': 'కష్టతరమైన స్థాయిని ఎంచుకోండి',
      'Choose a category': 'వర్గాన్ని ఎంచుకోండి',
      'You selected': 'మీరు ఎంచుకున్నారు',
      'Remember these': 'వీటిని గుర్తుంచుకోండి',
      'Now select the items in the correct order': 'ఇప్పుడు సరైన క్రమంలో అంశాలను ఎంచుకోండి',
      'Congratulations': 'అభినందనలు',
      'Your score': 'మీ స్కోరు',
      'Press Play to start': 'ప్రారంభించడానికి ప్లే నొక్కండి',
      // Family related phrases
      'Hey': 'హే',
      'he is': 'అతను',
      'she is': 'ఆమె',
      'Phone number is': 'ఫోన్ నంబర్',
      'your': 'మీ',
      // Memory activities related phrases
      'Let\'s try again': 'మళ్లీ ప్రయత్నిద్దాం',
      'Memorize this word': 'ఈ పదాన్ని గుర్తుంచుకోండి',
      'Enter the word you just saw': 'మీరు ఇప్పుడే చూసిన పదాన్ని నమోదు చేయండి',
      'Incorrect, try again': 'తప్పు, మళ్ళీ ప్రయత్నించండి',
      'Remember these objects': 'ఈ వస్తువులను గుర్తుంచుకోండి',
      'Now select all the objects you just saw': 'ఇప్పుడు మీరు చూసిన వస్తువులన్నింటినీ ఎంచుకోండి',
      'You correctly remembered': 'మీరు సరిగ్గా గుర్తుంచుకున్నారు',
      'out of': 'బయట',
      'objects': 'వస్తువులు',
      'Watch the color sequence carefully': 'రంగు క్రమాన్ని జాగ్రత్తగా చూడండి',
      'Now repeat the sequence': 'ఇప్పుడు క్రమాన్ని పునరావృతం చేయండి',
      'Correct!': 'సరైనది!',
      'Opening': 'తెరవడం',
      'Showing all memory games': 'అన్ని మెమరీ గేమ్‌లను చూపుతోంది',
      'Showing beginner level memory games': 'ప్రారంభ స్థాయి మెమరీ ఆటలను చూపుతోంది',
      'Showing intermediate level memory games': 'మధ్యంతర స్థాయి మెమరీ ఆటలను చూపుతోంది',
      'Showing advanced level memory games': 'అధునాతన స్థాయి మెమరీ ఆటలను చూపుతోంది',
      'Voice Assistance Disabled': 'వాయిస్ అసిస్టెన్స్ నిలిపివేయబడింది',
      'Please enable Voice Assistance in Settings to use this feature': 'ఈ ఫీచర్‌ని ఉపయోగించడానికి దయచేసి సెట్టింగ్‌లలో వాయిస్ అసిస్టెన్స్‌ని ప్రారంభించండి',
      'Reminder': 'రిమైండర్',
      'now it\'s time to': 'ఇప్పుడు సమయం',
      'the time is': 'సమయం',
    },
    'fr': { // French translations
      'What is your name?': 'Comment vous appelez-vous?',
      'My name is': 'Je m\'appelle',
      'How are you?': 'Comment allez-vous?',
      'I am fine': 'Je vais bien',
      'Good morning': 'Bonjour (matin)',
      'Good afternoon': 'Bonjour (après-midi)',
      'Good evening': 'Bonsoir',
      'Welcome to Memory Games': 'Bienvenue aux jeux de mémoire',
      'Welcome to Brain Training Activities': 'Bienvenue aux activités d\'entraînement cérébral',
      'Voice instructions enabled': 'Instructions vocales activées',
    },
    'de': { // German translations
      'What is your name?': 'Wie heißen Sie?',
      'My name is': 'Ich heiße',
      'How are you?': 'Wie geht es Ihnen?',
      'I am fine': 'Mir geht es gut',
      'Good morning': 'Guten Morgen',
      'Good afternoon': 'Guten Tag',
      'Good evening': 'Guten Abend',
      'Welcome to Memory Games': 'Willkommen bei den Gedächtnisspielen',
      'Welcome to Brain Training Activities': 'Willkommen bei den Gehirntrainingsaktivitäten',
      'Voice instructions enabled': 'Sprachanweisungen aktiviert',
    }
  };

  // Common words and their translations in different languages
  const wordTranslations = {
    'en': { 
      // English words (no translation needed as this is the source language)
    },
    'es': { // Spanish translations
      'Hello': 'Hola',
      'Welcome': 'Bienvenido',
      'Goodbye': 'Adiós',
      'Yes': 'Sí',
      'No': 'No',
      'Help': 'Ayuda',
      'Thank you': 'Gracias',
      'Please': 'Por favor',
      'Sorry': 'Lo siento',
      'Exercise': 'Ejercicio',
      'Game': 'Juego',
      'Level': 'Nivel',
      'Start': 'Iniciar',
      'Stop': 'Detener',
      'Pause': 'Pausa',
      'Resume': 'Reanudar',
      'Settings': 'Configuración',
      'Profile': 'Perfil',
      'Memory': 'Memoria',
      'Family': 'Familia',
      'Home': 'Inicio',
      'Today': 'Hoy',
      'Tomorrow': 'Mañana',
      'Yesterday': 'Ayer',
      'Easy': 'Fácil',
      'Medium': 'Medio',
      'Hard': 'Difícil',
      'Time': 'Tiempo',
      'Score': 'Puntuación',
      'Correct': 'Correcto',
      'Wrong': 'Incorrecto',
      'Voice': 'Voz',
      'Voice assistance': 'Asistencia de voz',
      'Disabled': 'Desactivado',
      'Enabled': 'Activado',
      'Successfully': 'Éxito',
      'Failed': 'Fallido',
      'Completed': 'Completado',
      'Remember': 'Recordar',
      'Sequence': 'Secuencia',
      'selected': 'seleccionado',
      'You': 'Tú',
      'is': 'es',
      'and': 'y',
      'or': 'o',
      'the': 'el',
      'with': 'con',
      'in': 'en',
      'for': 'para',
      'seconds': 'segundos',
      'minutes': 'minutos',
      'score': 'puntuación',
      'difficulty': 'dificultad',
      'objects': 'objetos',
      'cards': 'cartas',
      'match': 'coincidencia',
      'matching': 'coincidente',
      'number': 'número',
      'phone': 'teléfono',
      'emergency': 'emergencia',
      'contact': 'contacto',
      'doctor': 'doctor',
      'nurse': 'enfermera',
      'mother': 'madre',
      'father': 'padre',
      'son': 'hijo',
      'daughter': 'hija',
      'child': 'niño',
      'parent': 'padre',
      'sibling': 'hermano',
      'friend': 'amigo',
      'wife': 'esposa',
      'husband': 'esposo',
      'playing': 'jugando',
      'memorizing': 'memorizando',
      'remembering': 'recordando'
    },
    'hi': { // Hindi translations
      'Hello': 'नमस्ते',
      'Welcome': 'स्वागत है',
      'Goodbye': 'अलविदा',
      'Yes': 'हां',
      'No': 'नहीं',
      'Help': 'मदद',
      'Thank you': 'धन्यवाद',
      'Please': 'कृपया',
      'Sorry': 'क्षमा करें',
      'Exercise': 'व्यायाम',
      'Game': 'खेल',
      'Level': 'स्तर',
      'Start': 'शुरू करें',
      'Stop': 'रोकें',
      'Pause': 'ठहराव',
      'Resume': 'जारी रखें',
      'Settings': 'सेटिंग्स',
      'Profile': 'प्रोफ़ाइल',
      'Memory': 'स्मृति',
      'Family': 'परिवार',
      'Home': 'होम',
      'Today': 'आज',
      'Tomorrow': 'कल',
      'Yesterday': 'कल',
      'Easy': 'आसान',
      'Medium': 'मध्यम',
      'Hard': 'कठिन',
      'Time': 'समय',
      'Score': 'स्कोर',
      'Correct': 'सही',
      'Wrong': 'गलत',
      'Voice': 'आवाज़',
      'Voice assistance': 'वॉयस असिस्टेंस',
      'Disabled': 'अक्षम',
      'Enabled': 'सक्षम',
      'Successfully': 'सफलतापूर्वक',
      'Failed': 'विफल',
      'Completed': 'पूरा हुआ',
      'Remember': 'याद रखें',
      'Sequence': 'अनुक्रम',
      'selected': 'चयनित',
      'You': 'आप',
      'is': 'है',
      'and': 'और',
      'or': 'या',
      'the': 'द',
      'with': 'के साथ',
      'in': 'में',
      'for': 'के लिए',
      'seconds': 'सेकंड',
      'minutes': 'मिनट',
      'score': 'स्कोर',
      'difficulty': 'कठिनाई',
      'objects': 'वस्तुएँ',
      'cards': 'कार्ड',
      'match': 'मिलान',
      'matching': 'मिलान',
      'number': 'नंबर',
      'phone': 'फोन',
      'emergency': 'आपातकालीन',
      'contact': 'संपर्क',
      'doctor': 'डॉक्टर',
      'nurse': 'नर्स',
      'mother': 'माँ',
      'father': 'पिता',
      'son': 'बेटा',
      'daughter': 'बेटी',
      'child': 'बच्चा',
      'parent': 'माता-पिता',
      'sibling': 'भाई-बहन',
      'friend': 'मित्र',
      'wife': 'पत्नी',
      'husband': 'पति',
      'playing': 'खेल रहे हैं',
      'memorizing': 'याद कर रहे हैं',
      'remembering': 'याद कर रहे हैं'
    },
    'te': { // Telugu translations
      'Hello': 'హలో',
      'Welcome': 'స్వాగతం',
      'Goodbye': 'వీడ్కోలు',
      'Yes': 'అవును',
      'No': 'కాదు',
      'Help': 'సహాయం',
      'Thank you': 'ధన్యవాదాలు',
      'Please': 'దయచేసి',
      'Sorry': 'క్షమించండి',
      'Exercise': 'వ్యాయామం',
      'Game': 'ఆట',
      'Level': 'స్థాయి',
      'Start': 'ప్రారంభించు',
      'Stop': 'ఆపు',
      'Pause': 'నిలిపివేయి',
      'Resume': 'కొనసాగించు',
      'Settings': 'సెట్టింగ్‌లు',
      'Profile': 'ప్రొఫైల్',
      'Memory': 'జ్ఞాపకశక్తి',
      'Family': 'కుటుంబం',
      'Home': 'హోమ్',
      'Today': 'ఈరోజు',
      'Tomorrow': 'రేపు',
      'Yesterday': 'నిన్న',
      'Easy': 'సులభం',
      'Medium': 'మధ్యస్థం',
      'Hard': 'కష్టం',
      'Time': 'సమయం',
      'Score': 'స్కోరు',
      'Correct': 'సరైనది',
      'Wrong': 'తప్పు',
      'Voice': 'వాయిస్',
      'Voice assistance': 'వాయిస్ అసిస్టెన్స్',
      'Disabled': 'నిలిపివేయబడింది',
      'Enabled': 'ప్రారంభించబడింది',
      'Successfully': 'విజయవంతంగా',
      'Failed': 'విఫలమైంది',
      'Completed': 'పూర్తయింది',
      'Remember': 'గుర్తుంచుకోండి',
      'Sequence': 'క్రమం',
      'selected': 'ఎంచుకోబడింది',
      'You': 'మీరు',
      'is': 'ఉంది',
      'and': 'మరియు',
      'or': 'లేదా',
      'the': 'ది',
      'with': 'తో',
      'in': 'లో',
      'for': 'కోసం',
      'seconds': 'సెకన్లు',
      'minutes': 'నిమిషాలు',
      'score': 'స్కోరు',
      'difficulty': 'కష్టం',
      'objects': 'వస్తువులు',
      'cards': 'కార్డులు',
      'match': 'సరిపోలిక',
      'matching': 'సరిపోలడం',
      'number': 'సంఖ్య',
      'phone': 'ఫోన్',
      'emergency': 'అత్యవసర',
      'contact': 'సంప్రదింపు',
      'doctor': 'డాక్టర్',
      'nurse': 'నర్సు',
      'mother': 'తల్లి',
      'father': 'తండ్రి',
      'son': 'కుమారుడు',
      'daughter': 'కుమార్తె',
      'child': 'పిల్లవాడు',
      'parent': 'తల్లిదండ్రులు',
      'sibling': 'సోదరుడు/సోదరి',
      'friend': 'స్నేహితుడు',
      'wife': 'భార్య',
      'husband': 'భర్త',
      'playing': 'ఆడుతున్నారు',
      'memorizing': 'గుర్తుంచుకుంటున్నారు',
      'remembering': 'గుర్తుంచుకుంటున్నారు'
    }
  };

  try {
    // If no translation needed (already in English), return the original text
    if (langCode === 'en') {
      return text;
    }
    
    // First try to match the entire text as a phrase
    if (phraseTranslations[langCode]) {
      if (phraseTranslations[langCode][text]) {
        return phraseTranslations[langCode][text];
      }
      
      // Check if the text starts with a known phrase
      for (const [phrase, translation] of Object.entries(phraseTranslations[langCode])) {
        if (text.toLowerCase().startsWith(phrase.toLowerCase())) {
          return text.replace(new RegExp(`^${phrase}`, 'i'), translation);
        }
      }
    }
    
    // If entire phrase match fails, try word by word substitution
    if (wordTranslations[langCode]) {
      let translatedText = text;
      
      // Sort keys by length in descending order to handle longer phrases first
      const sortedKeys = Object.keys(wordTranslations[langCode]).sort((a, b) => b.length - a.length);
      
      for (const word of sortedKeys) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        translatedText = translatedText.replace(regex, wordTranslations[langCode][word]);
      }
      
      if (translatedText !== text) {
        return translatedText;
      }
    }
    
    // If no translation was found, return the original text
    return text;
  } catch (error) {
    console.error('Local translation error:', error);
    return text; // Return original text if translation fails
  }
};

// Break long text into paragraphs for translation
const breakTextIntoParagraphs = (text, maxLength = 1000) => {
  if (text.length <= maxLength) return [text];
  
  // Try to split by paragraphs first
  let paragraphs = text.split(/\n\s*\n/);
  
  // If we still have paragraphs longer than maxLength, split them further
  const result = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      result.push(paragraph);
    } else {
      // Split by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= maxLength) {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
          result.push(currentChunk);
          currentChunk = sentence;
        }
      }
      
      if (currentChunk) {
        result.push(currentChunk);
      }
    }
  }
  
  return result;
};

// Translate a complete speech, handling long texts properly
export const translateCompleteSpeech = async (text, targetLanguage) => {
  try {
    // Skip translation if empty or already in English
    if (!text || text.trim() === '' || targetLanguage.startsWith('en')) {
      return text;
    }
    
    // Check if the entire text is in cache
    const langCode = targetLanguage.split('-')[0];
    const cacheKey = `${text}_${langCode}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }
    
    // Break long text into manageable chunks
    const paragraphs = breakTextIntoParagraphs(text);
    
    // If it's just one paragraph, translate directly
    if (paragraphs.length === 1) {
      return await translateText(text, targetLanguage);
    }
    
    // Translate each paragraph
    const translatedParagraphs = [];
    for (const paragraph of paragraphs) {
      const translated = await translateText(paragraph, targetLanguage);
      translatedParagraphs.push(translated);
    }
    
    // Join the translated paragraphs
    const completeTranslation = translatedParagraphs.join('\n\n');
    
    // Cache the complete translation
    await saveTranslationToCache(text, langCode, completeTranslation);
    
    return completeTranslation;
  } catch (error) {
    console.error('Complete speech translation error:', error);
    return text; // Return original text if translation fails
  }
};

// Main translation function that tries multiple methods in sequence
export const translateText = async (text, targetLanguage) => {
  try {
    // Skip translation if the text is empty or undefined
    if (!text || text.trim() === '') {
      return text;
    }
    
    // Skip translation if target language is English
    if (targetLanguage.startsWith('en')) {
      return text;
    }
    
    // Extract just language code from language tag (e.g., 'en-US' -> 'en')
    const langCode = targetLanguage.split('-')[0];
    
    // Check cache first
    const cacheKey = `${text}_${langCode}`;
    if (translationCache[cacheKey]) {
      console.log('Translation found in cache');
      return translationCache[cacheKey];
    }
    
    console.log(`Translating text to ${langCode}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // First priority: Google Translate API
    if (GOOGLE_TRANSLATE_API_KEY && GOOGLE_TRANSLATE_API_KEY !== 'YOUR_GOOGLE_TRANSLATE_API_KEY') {
      try {
        console.log('Attempting Google Translate API...');
        const result = await translateWithGoogleAPI(text, targetLanguage);
        console.log('Google Translate API succeeded');
        return result;
      } catch (error) {
        console.log('Google Translate API failed, trying MyMemory API...');
      }
    } else {
      console.log('No Google API key configured, skipping to alternatives');
    }
    
    // Second priority: MyMemory API (free alternative)
    try {
      console.log('Attempting MyMemory API...');
      const result = await translateWithMyMemoryAPI(text, targetLanguage);
      console.log('MyMemory API succeeded');
      return result;
    } catch (error) {
      console.log('MyMemory API failed, trying LibreTranslate...');
    }
    
    // Third priority: LibreTranslate
    try {
      console.log('Attempting LibreTranslate...');
      const result = await translateWithLibreTranslate(text, targetLanguage);
      console.log('LibreTranslate succeeded');
      return result;
    } catch (error) {
      console.log('LibreTranslate failed, falling back to local dictionary...');
    }
    
    // Fallback: local dictionary
    console.log('Using local dictionary fallback...');
    const localTranslation = translateWithLocalDictionary(text, langCode);
    
    // If we got a translation from the dictionary, save it to cache
    if (localTranslation !== text) {
      await saveTranslationToCache(text, langCode, localTranslation);
      console.log('Local dictionary succeeded');
    } else {
      console.log('No translation found in local dictionary');
    }
    
    return localTranslation;
  } catch (error) {
    console.error('All translation methods failed:', error);
    return text; // Return original text if all translation methods fail
  }
};

// Function to speak text if voice assistance is enabled
// Added immediate parameter to ensure speech stops before new speech starts
export const speakWithVoiceCheck = async (message, voiceEnabled = true, immediate = false) => {
  try {
    // Check the global voice assistance setting first
    const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
    const isGloballyEnabled = storedVoiceAssistance === 'true'; // Stricter check - must be explicitly 'true'
    
    // Log the speech status for debugging
    console.log(`Speech request: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 
                `Global setting: ${isGloballyEnabled}`, 
                `Local setting: ${voiceEnabled}`,
                `Will speak: ${isGloballyEnabled && voiceEnabled}`);
    
    // Only proceed if both the global setting AND the local voiceEnabled parameter are true
    if (isGloballyEnabled && voiceEnabled) {
      // If immediate is true, stop any ongoing speech before starting new one
      if (immediate) {
        await stopSpeech();
      }
      
      // Get the voice language setting
      const language = await getVoiceLanguage();
      
      // Use the enhanced complete speech translation
      const translatedMessage = await translateCompleteSpeech(message, language);
      
      // Speak with better parameters and callbacks for debugging
      await Speech.speak(translatedMessage, { 
        language: language, 
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0,
        onStart: () => console.log('Speech started successfully'),
        onDone: () => console.log('Speech completed successfully'),
        onStopped: () => console.log('Speech was stopped'),
        onError: (error) => console.error('Speech error during playback:', error)
      });
      
      console.log(`Speaking translated text in ${language}: "${translatedMessage.substring(0, 50)}${translatedMessage.length > 50 ? '...' : ''}"`);
      return true; // Return true if speech was attempted
    } else {
      console.log('Voice assistance disabled. Not speaking: ' + message.substring(0, 50));
      return false; // Return false if speech was not attempted
    }
  } catch (error) {
    console.error('Speech error:', error);
    return false; // Return false if an error occurred
  }
};

// New function specifically for reminder voice alerts
export const speakReminder = async (reminder, username) => {
  try {
    // Verify reminder has required properties
    if (!reminder || !reminder.title || !reminder.time) {
      console.error('Invalid reminder object:', reminder);
      return false;
    }
    
    // Double-check if voice assistance is enabled before attempting to speak
    const voiceEnabled = await AsyncStorage.getItem('voiceAssistance');
    if (voiceEnabled !== 'true') {
      console.log('⛔ Skipping reminder speech - voice assistance is DISABLED in settings');
      return false;
    }
    
    // Format a friendly message
    const name = username || 'Friend';
    const message = `Hey ${name}, now it's time to ${reminder.title}. The time is ${reminder.time}.`;
    
    console.log('🔊 Speaking reminder alert with voice assistance ENABLED:', message);
    
    // Always stop any ongoing speech first to prevent overlapping announcements
    stopSpeech();
    
    // Attempt speech with immediate flag to ensure it doesn't queue
    const result = await speakWithVoiceCheck(message, true, true);
    
    // Log the result for debugging
    console.log(`Reminder speech result: ${result ? 'Success' : 'Failed'}`);
    
    return result;
  } catch (error) {
    console.error('Error speaking reminder:', error);
    return false;
  }
};

// Create a listener for navigation events to stop speech between screens
export const setupNavigationSpeechControl = (navigation) => {
  // This will run before a screen is removed from the stack
  const unsubscribeBefore = navigation.addListener('beforeRemove', (e) => {
    // Stop any ongoing speech when navigating away from current screen
    stopSpeech();
  });
  
  // This will run when a screen comes into focus
  const unsubscribeFocus = navigation.addListener('focus', (e) => {
    // Stop any ongoing speech when a new screen is focused
    stopSpeech();
  });
  
  return () => {
    unsubscribeBefore();
    unsubscribeFocus();
  };
};

// Function to initialize speech and ensure permissions
export const initSpeech = async () => {
  try {
    // Check if Speech module is available
    const available = await Speech.isAvailableAsync();
    
    if (!available) {
      console.log('Speech synthesis not available on this device');
      return false;
    }
    
    // On some platforms, this might trigger permission requests if needed
    await Speech.getAvailableVoicesAsync();
    
    console.log('Speech system initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing speech system:', error);
    return false;
  }
};

// Test speech functionality directly (no longer speaks automatically)
export const testSpeech = async (message = 'Speech test successful', immediate = true, shouldSpeak = false) => {
  try {
    console.log('Testing speech functionality...');
    
    // Make sure speech is initialized
    await initSpeech();
    
    // Stop any ongoing speech if immediate
    if (immediate) {
      await stopSpeech();
    }
    
    // Only actually speak if explicitly requested with shouldSpeak=true
    if (shouldSpeak) {
      console.log(`Speaking test message: "${message}"`);
      
      // Speak with detailed options and callbacks
      Speech.speak(message, {
        language: 'en-US',
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0,
        onStart: () => console.log('Test speech started'),
        onDone: () => console.log('Test speech completed successfully'),
        onStopped: () => console.log('Test speech was stopped'),
        onError: (error) => console.error('Test speech error:', error)
      });
    } else {
      // Just log that we would have spoken
      console.log(`Would have spoken (silenced): "${message}"`);
    }
    
    return true;
  } catch (error) {
    console.error('Error testing speech:', error);
    return false;
  }
};