import {
  AppKilledPlaybackBehavior,
  Capability,
  add,
  getPlaybackState,
  getProgress,
  pause,
  play,
  reset,
  seekTo,
  setupPlayer,
  updateNowPlayingMetadata,
} from 'daily-react-native-player';
import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const localWav = Image.resolveAssetSource(require('./assets/hynm.wav'));
const localMp3 = Image.resolveAssetSource(require('./assets/instrumentals.mp3'));

function requireAssetUri(
  asset: { uri?: string } | null | undefined,
  label: string
): string {
  const url = asset?.uri;
  if (!url) {
    throw new Error(`${label} asset failed to resolve`);
  }
  return url;
}

/** Android 13+: media notification will not appear without this grant. */
async function ensurePostNotifications(): Promise<string> {
  if (Platform.OS !== 'android' || typeof Platform.Version !== 'number' || Platform.Version < 33) {
    return 'not-required';
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return String(result);
}

export default function App() {
  const [state, setState] = useState('none');
  const [progress, setProgress] = useState({ position: 0, duration: 0, buffered: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [notifPerm, setNotifPerm] = useState('…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await ensurePostNotifications();
        if (!cancelled) {
          setNotifPerm(perm);
        }
        await setupPlayer({
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.Stop,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
          ],
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          autoUpdateMetadata: true,
        });
        if (!cancelled) {
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const id = setInterval(() => {
      void (async () => {
        try {
          const [nextState, nextProgress] = await Promise.all([
            getPlaybackState(),
            getProgress(),
          ]);
          setState(nextState);
          setProgress(nextProgress);
        } catch {
          // ignore poll errors
        }
      })();
    }, 400);
    return () => clearInterval(id);
  }, [ready]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(formatError(e));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.header}>daily-react-native-player</Text>
        <Text style={styles.subHeader}>
          Built primarily for Daily Bible - Offline & Audio
        </Text>
        <Text style={styles.hint}>
          Android: allow notifications when prompted, then Play — check shade + lock screen.
        </Text>
        <Text
          style={styles.link}
          onPress={() =>
            Linking.openURL(
              'https://play.google.com/store/apps/details?id=com.coommark.dailybible'
            )
          }>
          Google Play
        </Text>
        <Text
          style={styles.link}
          onPress={() =>
            Linking.openURL(
              'https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448'
            )
          }>
          App Store
        </Text>

        <Group name="Status">
          <Text style={styles.statusLine}>setup: {ready ? 'ready' : '…'}</Text>
          <Text style={styles.statusLine}>notifications: {notifPerm}</Text>
          <Text style={styles.statusLine}>state: {state}</Text>
          <Text style={styles.statusLine}>
            progress: {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s
            (buf {progress.buffered.toFixed(1)}s)
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Group>

        <Group name="Load">
          <View style={styles.btnColumn}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await add({
                    url: requireAssetUri(localWav, 'WAV'),
                    title: 'Hymn',
                    artist: 'Daily Bible',
                    album: 'Example',
                  });
                })
              }>
              <Text style={styles.btnLabel}>Load WAV (hynm.wav)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await add({
                    url: requireAssetUri(localMp3, 'MP3'),
                    title: 'Instrumentals',
                    artist: 'Daily Bible',
                    album: 'Example',
                  });
                })
              }>
              <Text style={styles.btnLabel}>Load MP3 (instrumentals.mp3)</Text>
            </Pressable>
          </View>
        </Group>

        <Group name="Transport">
          <View style={styles.btnColumn}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && styles.btnPressed,
              ]}
              onPress={() => run(() => play())}>
              <Text style={[styles.btnLabel, styles.btnLabelPrimary]}>Play</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() => run(() => pause())}>
              <Text style={styles.btnLabel}>Pause</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  const p = await getProgress();
                  await seekTo(Math.max(0, p.position - 10));
                })
              }>
              <Text style={styles.btnLabel}>Seek −10s</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  const p = await getProgress();
                  const next =
                    p.duration > 0 ? Math.min(p.duration, p.position + 10) : p.position + 10;
                  await seekTo(next);
                })
              }>
              <Text style={styles.btnLabel}>Seek +10s</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() => run(() => seekTo(0))}>
              <Text style={styles.btnLabel}>Seek 0</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() => run(() => reset())}>
              <Text style={styles.btnLabel}>Reset</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await updateNowPlayingMetadata({
                    title: 'Forced title',
                    artist: 'Forced artist',
                    album: 'Forced album',
                  });
                })
              }>
              <Text style={styles.btnLabel}>Force metadata override</Text>
            </Pressable>
          </View>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code) {
    return `${err.code}: ${err.message ?? ''}`;
  }
  return e instanceof Error ? e.message : String(e);
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    fontSize: 28,
    fontWeight: '600',
    marginHorizontal: 20,
    marginTop: 20,
    color: '#1A1A1A',
  },
  subHeader: {
    fontSize: 15,
    marginHorizontal: 20,
    marginTop: 8,
    color: '#555',
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 8,
    color: '#666',
    lineHeight: 18,
  },
  link: {
    fontSize: 15,
    marginHorizontal: 20,
    marginTop: 6,
    color: '#0B57D0',
    textDecorationLine: 'underline',
  },
  group: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  groupHeader: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  statusLine: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: '#B00020',
    marginTop: 8,
    fontSize: 14,
  },
  btnColumn: {
    gap: 8,
  },
  btn: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#1A1A1A',
  },
  btnSecondary: {
    backgroundColor: '#E8E8E8',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  btnLabelPrimary: {
    color: '#FFFFFF',
  },
});
