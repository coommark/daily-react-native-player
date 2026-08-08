import { registerRootComponent } from 'expo';
import { registerPlaybackService } from 'daily-react-native-player';

import App from './App';
import { playbackService } from './playbackService';

// Must run before registerRootComponent so Android headless remotes hit JS.
registerPlaybackService(() => playbackService);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
