import {
  add,
  getPlaybackState,
  getProgress,
  pause,
  play,
  reset,
  seekTo,
  setupPlayer,
} from 'daily-react-native-player';
import { useEffect, useState } from 'react';
import {
  Button,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

// Stable short progressive sample (Internet Archive — public domain recording excerpt).
const REMOTE_MP3 =
  'https://archive.org/download/testmp3testfile/mpthreetest.mp3';

const localWav = Image.resolveAssetSource(require('./assets/sample.wav'));

export default function App() {
  const [state, setState] = useState('none');
  const [progress, setProgress] = useState({ position: 0, duration: 0, buffered: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setupPlayer();
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
      <ScrollView style={styles.container}>
        <Text style={styles.header}>daily-react-native-player</Text>
        <Text style={styles.subHeader}>
          Built primarily for Daily Bible - Offline & Audio
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
          <Text>setup: {ready ? 'ready' : '…'}</Text>
          <Text>state: {state}</Text>
          <Text>
            progress: {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s
            (buf {progress.buffered.toFixed(1)}s)
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Group>

        <Group name="Load">
          <Button
            title="Load local WAV"
            onPress={() =>
              run(async () => {
                const url = localWav?.uri;
                if (!url) {
                  throw new Error('Local WAV asset failed to resolve');
                }
                await add({ url, title: 'Sample WAV' });
              })
            }
          />
          <View style={styles.spacer} />
          <Button
            title="Load remote MP3"
            onPress={() =>
              run(async () => {
                await add({ url: REMOTE_MP3, title: 'Remote MP3' });
              })
            }
          />
        </Group>

        <Group name="Transport">
          <Button title="Play" onPress={() => run(() => play())} />
          <View style={styles.spacer} />
          <Button title="Pause" onPress={() => run(() => pause())} />
          <View style={styles.spacer} />
          <Button
            title="Seek −10s"
            onPress={() =>
              run(async () => {
                const p = await getProgress();
                await seekTo(Math.max(0, p.position - 10));
              })
            }
          />
          <View style={styles.spacer} />
          <Button
            title="Seek +10s"
            onPress={() =>
              run(async () => {
                const p = await getProgress();
                const next = p.duration > 0 ? Math.min(p.duration, p.position + 10) : p.position + 10;
                await seekTo(next);
              })
            }
          />
          <View style={styles.spacer} />
          <Button title="Seek 0" onPress={() => run(() => seekTo(0))} />
          <View style={styles.spacer} />
          <Button title="Reset" onPress={() => run(() => reset())} />
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

const styles = {
  header: { fontSize: 28, marginHorizontal: 20, marginTop: 20 },
  subHeader: { fontSize: 16, marginHorizontal: 20, marginTop: 8, color: '#333' },
  link: {
    fontSize: 16,
    marginHorizontal: 20,
    marginTop: 6,
    color: '#0B57D0',
    textDecorationLine: 'underline' as const,
  },
  groupHeader: { fontSize: 20, marginBottom: 12 },
  group: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  error: { color: '#B00020', marginTop: 8 },
  spacer: { height: 8 },
  container: { flex: 1, backgroundColor: '#eee' },
};
