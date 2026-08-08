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
const asset = Image.resolveAssetSource(require('./assets/hynm.wav'));
await reset();
await add({ url: asset.uri });
await play();

await seekTo(10);
const { position, duration } = await getProgress();
const state = await getPlaybackState();
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

Full guide: [`queue.md`](./queue.md). Example app: **Load multi-track queue (3)** + Skip next/previous.

The example app demos local progressive fixtures under `example/assets/`:

- `hynm.wav`
- `instrumentals.mp3`

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

The example depends on `daily-react-native-player` via `file:..` (npm-consumer style) and lists the config plugin in `app.json`. After prebuild, verify injections with `yarn assert:prebuild` from the repo root.

### T3 / T4 smoke checklist

- [x] Android: local WAV (`hynm.wav`) play/pause/seek
- [x] Android: local MP3 (`instrumentals.mp3`) play/pause/seek
- [x] iOS: same
- [x] `reset` then load again works
- [x] Fast Refresh does not brick setup (idempotent `setupPlayer`)
- [x] Invalid URL surfaces a `PlayerError` / `PlayerException` code
- [ ] **Physical** Android: lock screen remotes → JS service + ContinuePlayback
- [ ] **Physical** iOS: Now Playing remotes → JS service

Emulator audio fidelity is non-authoritative for P0 background QA. See the device matrix in [`background-playback.md`](./background-playback.md).

**CI:** Build → typecheck (src + plugin) → lint → tests → plugin tests → pack:check. Android `assembleRelease` still requires local example prebuild.

## Next

1. Complete T4/T5 physical device QA (remotes → JS while backgrounded)
2. Progressive mutation + `setRate` (T8)
3. HLS + seek-after-ready (T9)

Silence tracks (T7) are implemented — see [`silence-tracks.md`](./silence-tracks.md).

See [`ROADMAP.md`](../ROADMAP.md).
