# Silence tracks (core)

First-class queue items used for speech verse pauses and ambient loop-all gaps in
**[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

Silence is a **real playlist row**, not a timer between items. Skip, seek, progress,
`PlaybackActiveTrackChanged`, MediaSession / Now Playing, and host rate policy can all
treat it like any other track.

## Product uses

1. **Verse / phrase pauses** — insert exact gaps between progressive TTS or speech URLs
2. **Chapter holds** — a fixed pause before the next speech item
3. **Ambient loop-all gaps (T10)** — the same helper between ambient tracks when dual-audio ships

## Why not a timer?

Timers break skip-over, progress duration, active-track identity, and lock-screen honesty.
A silence row keeps one queue model for speech and (later) ambient.

## API

```ts
import {
  add,
  createSilenceTrack,
  isSilenceTrack,
  getActiveTrack,
} from 'daily-react-native-player';

const gap = createSilenceTrack({ durationMs: 800, id: 'verse-pause' });
// → { type: 'silence', url: 'silence:800', duration: 0.8, id: 'verse-pause' }

await add([speechA, gap, speechB]);

if (isSilenceTrack(await getActiveTrack())) {
  // Host / T8 policy: often setRate(1) so slow speech rate does not stretch the gap
}
```

| Field | Notes |
| --- | --- |
| `type` | Always `'silence'` |
| `url` | Canonical `silence:<integerMs>` (public identity — never a host file path) |
| `duration` | Seconds (`durationMs / 1000`) |
| Bounds | Integer `durationMs` in `(0, 300_000]` (5 minutes max) |

Prefer `createSilenceTrack` (or an already-canonical manual track). Mismatched
`type` / `url` / `duration` are rejected.

## Insert pattern

```ts
await reset();
await add([
  { url: speechUrl, title: 'Genesis 1:1' },
  createSilenceTrack({ durationMs: 500 }),
  { url: nextUrl, title: 'Genesis 1:2' },
]);
await play();
```

See the example app **Load speech + silence gap** button.

## Host responsibilities

- Decide when and how long gaps should be
- Until T8 lands auto rate handling: if speech plays below 1×, force `setRate(1)` while
  `isSilenceTrack(active)` so pause WAVs are not stretched, then restore the user rate
- Do **not** depend on host `expo-file-system` for silence files

## Native ownership

| Platform | Implementation |
| --- | --- |
| Android | Media3 `SilenceMediaSource` (no dummy progressive file); `MediaItem.mediaId` = track id |
| iOS | Cached PCM WAV **22050 Hz, mono, 16-bit** under app Caches |

No host filesystem dependency. iOS Caches may be purged by the OS; the module regenerates on demand.

## Limits & acceptance

- Progress duration for silence should match `durationMs / 1000` within about **±20 ms** once ready
- Public `getQueue` / events never leak internal `file://` cache paths
- Rate ≠ 1 on silence is allowed by the player; stretching is a host policy concern until T8
- Silence is **22050 Hz mono** (Piper TTS). Adjacent speech at other rates (e.g. 48 kHz stereo hymns in the example) can click at boundaries; iOS mutes briefly across item swaps to reduce that. Prefer matching speech format for the cleanest gaps.

## Non-goals

- Not TTS / ONNX generation
- Not a substitute for `pause()`
- Not ambient dual-audio by itself (T10 consumes this helper)
