/**
 * Plugin contract tests — run against compiled plugin/build (CommonJS).
 * Plain JS so Jest needs no Babel/TS transform for the plugin package.
 */
const { compileModsAsync } = require('expo/config-plugins');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pluginModule = require('../../build');
const withDailyReactNativePlayer = pluginModule.default;
const { ANDROID_PERMISSIONS, PLAYBACK_SERVICE_CLASS, mergeAudioBackgroundMode, validateProps } =
  pluginModule;

function baseConfig() {
  return {
    name: 'test-app',
    slug: 'test-app',
    android: { package: 'com.test.app' },
    ios: { bundleIdentifier: 'com.test.app' },
  };
}

async function runIosPlugin(props, configOverride) {
  let config = withDailyReactNativePlayer({ ...baseConfig(), ...configOverride }, props);
  config = await compileModsAsync(config, {
    projectRoot: '/tmp/daily-react-native-player-plugin-test',
    platforms: ['ios'],
    introspect: true,
  });
  return config;
}

function makeAndroidProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drnp-plugin-'));
  const androidApp = path.join(root, 'android', 'app', 'src', 'main');
  fs.mkdirSync(androidApp, { recursive: true });
  fs.writeFileSync(
    path.join(androidApp, 'AndroidManifest.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:name=".MainApplication">
  </application>
</manifest>`
  );
  return { root, manifestPath: path.join(androidApp, 'AndroidManifest.xml') };
}

async function runAndroidPlugin(props) {
  const { root, manifestPath } = makeAndroidProject();
  let config = withDailyReactNativePlayer(baseConfig(), props);
  config = await compileModsAsync(config, {
    projectRoot: root,
    platforms: ['android'],
  });
  return {
    config,
    manifestXml: fs.readFileSync(manifestPath, 'utf8'),
  };
}

describe('mergeAudioBackgroundMode', () => {
  it('adds audio when missing', () => {
    expect(mergeAudioBackgroundMode(undefined)).toEqual(['audio']);
    expect(mergeAudioBackgroundMode(['fetch'])).toEqual(['fetch', 'audio']);
  });

  it('does not duplicate audio', () => {
    expect(mergeAudioBackgroundMode(['audio', 'fetch'])).toEqual(['audio', 'fetch']);
  });
});

describe('validateProps', () => {
  it('accepts undefined and boolean', () => {
    expect(() => validateProps()).not.toThrow();
    expect(() => validateProps({ enableBackgroundPlayback: true })).not.toThrow();
    expect(() => validateProps({ enableBackgroundPlayback: false })).not.toThrow();
  });

  it('rejects non-boolean enableBackgroundPlayback', () => {
    expect(() => validateProps({ enableBackgroundPlayback: 'yes' })).toThrow(
      /Failed to configure daily-react-native-player/
    );
  });
});

describe('withDailyReactNativePlayer', () => {
  it('injects audio UIBackgroundModes by default', async () => {
    const config = await runIosPlugin();
    const modes = config.ios?.infoPlist?.UIBackgroundModes;
    expect(modes).toEqual(expect.arrayContaining(['audio']));
  });

  it('preserves existing background modes', async () => {
    const config = await runIosPlugin(
      {},
      { ios: { infoPlist: { UIBackgroundModes: ['location', 'fetch'] } } }
    );
    const modes = config.ios.infoPlist.UIBackgroundModes;
    expect(modes).toEqual(expect.arrayContaining(['location', 'fetch', 'audio']));
    expect(modes.filter((m) => m === 'audio')).toHaveLength(1);
  });

  it('is idempotent for audio mode via merge helper', () => {
    const once = mergeAudioBackgroundMode(['fetch']);
    const twice = mergeAudioBackgroundMode(once);
    expect(twice.filter((m) => m === 'audio')).toHaveLength(1);
  });

  it('injects FGS and notification permissions by default', async () => {
    const config = await runIosPlugin();
    // permissions also applied via withPermissions on the Expo config
    const list = config.android?.permissions ?? [];
    // withPermissions may only show after android platform compile — assert via android run
    const { config: androidConfig } = await runAndroidPlugin();
    const androidList = androidConfig.android?.permissions ?? list;
    const combined = [...new Set([...(list || []), ...(androidList || [])])];
    // Fallback: read manifest for uses-permission
    const { manifestXml } = await runAndroidPlugin();
    for (const p of ANDROID_PERMISSIONS) {
      expect(manifestXml).toContain(p);
    }
    expect(combined.length >= 0).toBe(true);
  });

  it('injects PlaybackService with mediaPlayback', async () => {
    const { manifestXml } = await runAndroidPlugin();
    expect(manifestXml).toContain(PLAYBACK_SERVICE_CLASS);
    expect(manifestXml).toContain('mediaPlayback');
    expect(manifestXml).toMatch(/android:exported="true"/);
    expect(manifestXml).toContain('androidx.media3.session.MediaSessionService');
    expect(manifestXml).toMatch(/android:stopWithTask="false"/);
  });

  it('skips injection when enableBackgroundPlayback is false', async () => {
    const config = await runIosPlugin({ enableBackgroundPlayback: false });
    const modes = config.ios?.infoPlist?.UIBackgroundModes ?? [];
    expect(modes).not.toContain('audio');

    const { manifestXml } = await runAndroidPlugin({
      enableBackgroundPlayback: false,
    });
    expect(manifestXml).not.toContain(PLAYBACK_SERVICE_CLASS);
    for (const p of ANDROID_PERMISSIONS) {
      expect(manifestXml).not.toContain(p);
    }
  });
});
