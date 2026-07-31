import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import { AndroidConfig, ConfigPlugin, withAndroidManifest } from 'expo/config-plugins';

import {
  ANDROID_PERMISSIONS,
  DailyReactNativePlayerPluginProps,
  PLAYBACK_SERVICE_CLASS,
} from './types';

type ManifestService = NonNullable<ManifestApplication['service']>[number];

function findPlaybackServiceIndex(application: ManifestApplication): number {
  const services = application.service ?? [];
  return services.findIndex((service) => service.$?.['android:name'] === PLAYBACK_SERVICE_CLASS);
}

function buildPlaybackService(): ManifestService {
  const attrs: Record<string, string> = {
    'android:name': PLAYBACK_SERVICE_CLASS,
    'android:exported': 'true',
    'android:foregroundServiceType': 'mediaPlayback',
    // Prepares ContinuePlayback (T4); not in upstream ManifestServiceAttributes yet
    'android:stopWithTask': 'false',
  };
  return {
    $: attrs as ManifestService['$'],
    'intent-filter': [
      {
        action: [
          {
            $: {
              'android:name': 'androidx.media3.session.MediaSessionService',
            },
          },
        ],
      },
    ],
  };
}

/**
 * Injects FGS / notification permissions and PlaybackService into the app manifest.
 * Does not declare the service in the library AAR manifest (plugin-owned).
 */
export const withAndroidMediaPlayback: ConfigPlugin<DailyReactNativePlayerPluginProps> = (
  config,
  props = {}
) => {
  if (props.enableBackgroundPlayback === false) {
    config = withAndroidManifest(config, (config) => {
      const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
      const index = findPlaybackServiceIndex(application);
      if (index >= 0 && application.service) {
        application.service.splice(index, 1);
      }
      return config;
    });
    return config;
  }

  config = AndroidConfig.Permissions.withPermissions(config, [...ANDROID_PERMISSIONS]);

  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    if (!application.service) {
      application.service = [];
    }
    const index = findPlaybackServiceIndex(application);
    const service = buildPlaybackService();
    if (index >= 0) {
      application.service[index] = service;
    } else {
      application.service.push(service);
    }
    return config;
  });

  return config;
};
