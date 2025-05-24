import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';

// Register the app
AppRegistry.registerComponent('MindFlow', () => App);
registerRootComponent(App);

export default App;