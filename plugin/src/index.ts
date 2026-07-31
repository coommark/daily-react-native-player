import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';

import { DailyReactNativePlayerPluginProps, validateProps } from './types';
import { withAndroidMediaPlayback } from './withAndroidMediaPlayback';
import { withIosBackgroundAudio } from './withIosBackgroundAudio';

const pkg = require('../../package.json') as { name: string; version: string };

const withDailyReactNativePlayer: ConfigPlugin<DailyReactNativePlayerPluginProps | void> = (
  config,
  props = {}
) => {
  try {
    const options = props ?? {};
    validateProps(options);
    config = withIosBackgroundAudio(config, options);
    config = withAndroidMediaPlayback(config, options);
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Failed to configure daily-react-native-player:')) {
      throw error;
    }
    throw new Error(`Failed to configure daily-react-native-player: ${message}`);
  }
};

export type { DailyReactNativePlayerPluginProps };
export {
  ANDROID_PERMISSIONS,
  PLAYBACK_SERVICE_CLASS,
  mergeAudioBackgroundMode,
  validateProps,
} from './types';
export { withAndroidMediaPlayback } from './withAndroidMediaPlayback';
export { withIosBackgroundAudio } from './withIosBackgroundAudio';

export default createRunOncePlugin(withDailyReactNativePlayer, pkg.name, pkg.version);
