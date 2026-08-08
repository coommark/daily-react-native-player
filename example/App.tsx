import {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  add,
  addEventListener,
  createSilenceTrack,
  getActiveTrack,
  getActiveTrackIndex,
  getPlaybackState,
  getProgress,
  getQueue,
  pause,
  play,
  remove,
  reset,
  seekTo,
  setupPlayer,
  skipToNext,
  skipToPrevious,
  setRate,
  ambientSetPlaylist,
  ambientSetVolume,
  ambientPlay,
  ambientFade,
  ambientStop,
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

const john1 = Image.resolveAssetSource(require('./assets/john-1.mp3'));
const john2 = Image.resolveAssetSource(require('./assets/john-2.mp3'));
const john3 = Image.resolveAssetSource(require('./assets/john-3.mp3'));
const ambientBed = Image.resolveAssetSource(require('./assets/instrumentals.mp3'));

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

function johnChapterTracks() {
  return [
    {
      url: requireAssetUri(john1, 'John 1'),
      title: 'John 1',
      artist: 'Daily Bible',
      album: 'Gospel of John',
    },
    {
      url: requireAssetUri(john2, 'John 2'),
      title: 'John 2',
      artist: 'Daily Bible',
      album: 'Gospel of John',
    },
    {
      url: requireAssetUri(john3, 'John 3'),
      title: 'John 3',
      artist: 'Daily Bible',
      album: 'Gospel of John',
    },
  ];
}

function ambientBedUrl(): string {
  return requireAssetUri(ambientBed, 'Instrumentals');
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
  const [queueLen, setQueueLen] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [lastEvent, setLastEvent] = useState<string>('');

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
          progressUpdateEventInterval: 1,
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
    const subs = [
      addEventListener(Event.PlaybackState, (e) => {
        setState(e.state);
        setLastEvent(`state:${e.state}`);
      }),
      addEventListener(Event.PlaybackActiveTrackChanged, (e) => {
        setActiveIndex(e.index ?? undefined);
        setActiveTitle(e.track?.title ?? e.track?.id ?? '');
        setLastEvent(`active:${e.index}`);
      }),
      addEventListener(Event.PlaybackQueueEnded, () => {
        setLastEvent('queue-ended');
      }),
      addEventListener(Event.PlaybackProgressUpdated, (e) => {
        setProgress(e);
      }),
    ];
    return () => {
      for (const s of subs) s.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const id = setInterval(() => {
      void (async () => {
        try {
          const [playback, nextProgress, q, idx, track] = await Promise.all([
            getPlaybackState(),
            getProgress(),
            getQueue(),
            getActiveTrackIndex(),
            getActiveTrack(),
          ]);
          setState(playback.state);
          setProgress(nextProgress);
          setQueueLen(q.length);
          setActiveIndex(idx);
          setActiveTitle(track?.title ?? track?.id ?? '');
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
          Android: allow notifications when prompted, then Play — check shade + lock screen. Next/Prev
          remotes call skip* via playbackService.
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
            queue: {queueLen} · active: {activeIndex ?? '—'} {activeTitle ? `(${activeTitle})` : ''}
          </Text>
          <Text style={styles.statusLine}>
            progress: {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s
            (buf {progress.buffered.toFixed(1)}s)
          </Text>
          <Text style={styles.statusLine}>last event: {lastEvent || '—'}</Text>
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
                  await reset();
                  await add(johnChapterTracks());
                  await play();
                })
              }>
              <Text style={styles.btnLabel}>Load John 1–3 playlist</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await reset();
                  await add([
                    johnChapterTracks()[0],
                    {
                      ...createSilenceTrack({ durationMs: 2000, id: 'gap-2s' }),
                      title: 'Silence (2s)',
                    },
                    johnChapterTracks()[1],
                  ]);
                  await play();
                })
              }>
              <Text style={styles.btnLabel}>John 1 + silence + John 2</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await setRate(1.25);
                  await play();
                })
              }>
              <Text style={styles.btnLabel}>setRate 1.25× (silence stays 1×)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await setRate(1);
                })
              }>
              <Text style={styles.btnLabel}>setRate 1×</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await reset();
                  await add({
                    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
                    type: 'hls',
                    title: 'HLS sample (Apple bipbop)',
                    artist: 'Example',
                    album: 'HLS',
                  });
                  await seekTo(5);
                  await play();
                })
              }>
              <Text style={styles.btnLabel}>Load HLS VOD + seek 5s</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await ambientSetPlaylist([ambientBedUrl()], true);
                  await ambientSetVolume(0);
                  await ambientPlay();
                  await ambientFade(0.12, 1200);
                })
              }>
              <Text style={styles.btnLabel}>Ambient under (instrumentals)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await ambientStop();
                })
              }>
              <Text style={styles.btnLabel}>Ambient stop</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  await reset();
                  await add(johnChapterTracks()[0]);
                })
              }>
              <Text style={styles.btnLabel}>Load John 1 only</Text>
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
              onPress={() => run(() => skipToNext())}>
              <Text style={styles.btnLabel}>Skip next</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() => run(() => skipToPrevious())}>
              <Text style={styles.btnLabel}>Skip previous</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              onPress={() =>
                run(async () => {
                  const idx = await getActiveTrackIndex();
                  if (idx != null) {
                    await remove(idx);
                  }
                })
              }>
              <Text style={styles.btnLabel}>Remove active</Text>
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
