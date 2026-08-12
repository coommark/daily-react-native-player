# Getting started

**Primary host app:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Requirements

- **Expo** (Expo Modules Core) — required peer; bare RN without Expo is not supported
- New Architecture only (mandatory on Expo SDK 57+)
- Expo SDK 57+ / React Native 0.86+
- Hosts on Expo &lt;57 must upgrade the app before installing this package
- iOS and/or Android device or simulator (device required later for P0 background QA)

## Install (CNG / Expo)

```bash
npx expo install daily-react-native-player
```

```json
{
  "expo": {
    "plugins": ["daily-react-native-player"]
  }
}
```

Props (all optional):

| Prop | Default | Purpose |
| --- | --- | --- |
| `enableBackgroundPlayback` | `true` | Inject iOS audio BG mode + Android FGS perms + `PlaybackService` |

Then `npx expo prebuild` (or a continuous native generation workflow).

Bare React Native hosts: see the manual Info.plist / AndroidManifest snippet in [`background-playback.md`](./background-playback.md).

## Playback service (T5 — required for lock screen & Bluetooth remotes)

Lock screen, notification shade, Control Center, and **Bluetooth / headset** buttons only work if you register a JS playback service **before** the root component (Android headless remotes need this to keep JS alive):

```ts
// index.ts
import { registerPlaybackService } from 'daily-react-native-player';
import { registerRootComponent } from 'expo';
import App from './App';
import { playbackService } from './playbackService';

registerPlaybackService(() => playbackService);
registerRootComponent(App);
```

In `playbackService`, handle `Event.RemotePlay` / `RemotePause` / `RemoteNext` / … and call `play()`, `pause()`, `skipToNext()`, etc. Remotes are **emit-only** — they do not surprise-play without your handler.

See [`background-playback.md`](./background-playback.md) (P0 surfaces) and [`api.md`](./api.md) (`Event.Remote*`). Do not use `expo-background-task` for this.

## Progressive playback (T3)

```ts
import {
  setupPlayer,
  add,
  play,
  pause,
  seekTo,
  getProgress,
  getPlaybackState,
  reset,
} from 'daily-react-native-player';
import { Image } from 'react-native';

await setupPlayer();

// Single track — add to an empty queue (or reset first to replace)
await reset();
await add({ url: 'https://example.com/chapter.mp3', title: 'Chapter 1' });
await play();

// Local bundled asset — resolve before add
const asset = Image.resolveAssetSource(require('./assets/john-1.mp3'));
await reset();
await add({ url: asset.uri, title: 'John 1' });
await play();

await seekTo(10);
const { position, duration } = await getProgress();
const { state } = await getPlaybackState();
await pause();
await reset();
```

`add` **appends**. To replace content: `reset()` then `add(...)`. See [`api.md`](./api.md).

## Multi-track playlist (T6)

Load a whole chapter (or lesson) as a playlist. Tracks auto-advance; Playback\* events drive UI; lock-screen Next/Previous hit your `registerPlaybackService` → call `skipToNext` / `skipToPrevious`.

```ts
import {
  setupPlayer,
  add,
  play,
  skipToNext,
  getQueue,
  getActiveTrackIndex,
  addEventListener,
  Event,
} from 'daily-react-native-player';

await setupPlayer({ progressUpdateEventInterval: 1 });

await add([
  { url: 'https://example.com/v1.wav', title: 'Verse 1' },
  { url: 'https://example.com/v2.wav', title: 'Verse 2' },
  { url: 'https://example.com/v3.wav', title: 'Verse 3' },
]);

addEventListener(Event.PlaybackActiveTrackChanged, ({ index, track }) => {
  console.log('active', index, track?.title);
});

addEventListener(Event.PlaybackQueueEnded, () => {
  console.log('playlist finished');
});

await play();
await skipToNext();

const queue = await getQueue();
const active = await getActiveTrackIndex();
```

Full guide: [`queue.md`](./queue.md). Example app: **Load John 1–3 playlist** + Skip next/previous.

The example app demos local progressive fixtures under `example/assets/`:

- `john-1.mp3`, `john-2.mp3`, `john-3.mp3` (speech playlist)
- `instrumentals.mp3` (ambient bed)

## Local development

From the repo root:

```bash
yarn
yarn build
# keep build fresh while editing TS:
# npx tsc --watch
cd example
yarn
yarn start
```

Native runs:

```bash
cd example
yarn ios
# or
yarn android
```

After adding a native Expo module (for example `expo-linking`), rebuild the binary — Metro alone cannot link it:

```bash
cd example
npx expo run:ios
# or
npx expo run:android
```

If `expo run:ios` fails on **Xcode 26.2** inside `expo-modules-jsi` (`JavaScriptCodable+Date.swift` / `abs` ambiguous), the example `postinstall` script applies the workaround from [expo#47957](https://github.com/expo/expo/issues/47957). Re-run `yarn` in `example/`, then:

```bash
rm -rf node_modules/expo-modules-jsi/apple/Products
npx expo run:ios
```

Prefer **Xcode 26.4+** (Expo’s recommended toolchain for SDK 57). Daily Bible (Expo SDK 57) should pin a matching EAS image when building natively.

The example depends on `daily-react-native-player` via `file:..` (npm-consumer style) and lists the config plugin in `app.json`. After prebuild, verify injections with `yarn assert:prebuild` from the repo root (or `yarn assert:prebuild -- --platform android` after Android-only prebuild, as CI does).

### T3 / T4 smoke checklist

- [x] Android: local John chapter MP3 play/pause/seek
- [x] Android: ambient bed (`instrumentals.mp3`) under speech
- [x] iOS: same
- [x] `reset` then load again works
- [x] Fast Refresh does not brick setup (idempotent `setupPlayer`)
- [x] Invalid URL surfaces a `PlayerError` / `PlayerException` code
- [ ] **Physical** Android: lock screen remotes → JS service + ContinuePlayback
- [ ] **Physical** iOS: Now Playing remotes → JS service

Emulator audio fidelity is non-authoritative for P0 background QA. See the device matrix in [`background-playback.md`](./background-playback.md).

**CI:** Build → typecheck (src + plugin) → lint → tests → plugin tests → pack:check → example `assembleRelease` (R8).

Host SLAs: [`contracts.md`](./contracts.md). Recommended Stop: `pause()` then `reset()`.

## Host integration notes (Daily Bible)

Lessons from wiring this package into [Daily Bible](https://dailybiblenow.com) as a `file:` / workspace consumer:

| Topic | Guidance |
| --- | --- |
| **API shape** | Prefer named exports. `getPlaybackState()` → `{ state }`. Progress events include `track` (active index). `State.Buffering` / `State.Stopped` are aliases of `loading` / `none`. `TrackType` is a const object (`Default` / `HLS` / `Silence`). |
| **Progressive TTS** | Arm `setPlayWhenReady(true)` before the first `add` if the host starts play intent while synthesizing; call `play()` once a track exists if needed. |
| **Contemplative pauses** | Append `createSilenceTrack({ durationMs })` while speech plays. Native does **not** bump `queueEpoch` on append (would starve progress). iOS silence WAVs are **prewarmed** async on add; ensure-on-activate stays sync. |
| **Now Playing sync** | Safe to call `updateMetadataForTrack` / `updateNowPlayingMetadata` on every verse — Android patches metadata without rebinding (ADR-19). |
| **Local Expo link** | Nested `node_modules/expo` inside a `file:` player can break iOS pods. Prefer the host’s Expo modules (Bible uses a postinstall that strips nested native Expo and symlinks host `expo` / `@expo/config-plugins`). |
| **Config plugin** | Keep `"daily-react-native-player"` in the host `app.json` plugins list and prebuild after upgrades. |

## Next

1. Complete **physical** T4/T5/T11 device QA matrices in [`background-playback.md`](./background-playback.md)
2. Tag `v0.1.0` / publish when device QA is signed and requested

Core MVP + ambient + hardening + packaging are implemented. See [`ROADMAP.md`](../ROADMAP.md).
