export type DailyReactNativePlayerPluginProps = {
  /**
   * When true (default), inject iOS audio background mode, Android FGS
   * permissions, and the MediaSessionService declaration.
   */
  enableBackgroundPlayback?: boolean;
};

export const PLAYBACK_SERVICE_CLASS = 'expo.modules.dailyreactnativeplayer.PlaybackService';

export const ANDROID_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
] as const;

export function validateProps(props: DailyReactNativePlayerPluginProps = {}): void {
  if (
    props.enableBackgroundPlayback !== undefined &&
    typeof props.enableBackgroundPlayback !== 'boolean'
  ) {
    throw new Error(
      'Failed to configure daily-react-native-player: enableBackgroundPlayback must be a boolean'
    );
  }
}

export function mergeAudioBackgroundMode(existing: string[] | string | undefined): string[] {
  const modes = Array.isArray(existing) ? [...existing] : existing ? [existing] : [];
  if (!modes.includes('audio')) {
    modes.push('audio');
  }
  return modes;
}
