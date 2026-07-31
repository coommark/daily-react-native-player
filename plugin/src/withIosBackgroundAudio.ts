import { ConfigPlugin, withInfoPlist } from 'expo/config-plugins';

import { DailyReactNativePlayerPluginProps, mergeAudioBackgroundMode } from './types';

/**
 * Ensures UIBackgroundModes includes `audio` without clobbering other modes.
 */
export const withIosBackgroundAudio: ConfigPlugin<DailyReactNativePlayerPluginProps> = (
  config,
  props = {}
) => {
  if (props.enableBackgroundPlayback === false) {
    return config;
  }

  return withInfoPlist(config, (config) => {
    config.modResults.UIBackgroundModes = mergeAudioBackgroundMode(
      config.modResults.UIBackgroundModes as string[] | string | undefined
    );
    return config;
  });
};
