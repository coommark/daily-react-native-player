# Getting started

**Primary host app:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Requirements

- **Expo** (Expo Modules Core) — required peer; bare RN without Expo is not supported
- New Architecture enabled
- Expo SDK 53+ / React Native 0.79+
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

// Remote progressive (HTTPS preferred)
await add({ url: 'https://example.com/chapter.mp3', title: 'Chapter 1' });
await play();

// Local bundled asset — resolve before add
const asset = Image.resolveAssetSource(require('./assets/hynm.wav'));
await add({ url: asset.uri });
await play();

await seekTo(10);
const { position, duration } = await getProgress();
const state = await getPlaybackState();
await pause();
await reset();
```

See [`api.md`](./api.md) for URI rules, errors, and single-source `add` semantics.

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

If `expo run:ios` fails on **Xcode 26.2** inside `expo-modules-jsi` (`JavaScriptCodable+Date.swift` / `abs` ambiguous), the example `postinstall` script applies the workaround from [expo#47957](https://github.com/expo/expo/issues/47957). Re-run `yarn` in `example/`, then:

```bash
rm -rf node_modules/expo-modules-jsi/apple/Products
npx expo run:ios
```

Prefer **Xcode 26.4+** when available (Expo’s recommended toolchain for recent SDKs). Daily Bible (Expo SDK 53) EAS builds default to **Xcode 16.4** unless `eas.json` pins another image.

The example depends on `daily-react-native-player` via `file:..` (npm-consumer style) and lists the config plugin in `app.json`. After prebuild, verify injections with `yarn assert:prebuild` from the repo root.

### T3 smoke checklist

- [x] Android: local WAV (`hynm.wav`) play/pause/seek
- [x] Android: local MP3 (`instrumentals.mp3`) play/pause/seek
- [x] iOS: same
- [x] `reset` then load again works
- [x] Fast Refresh does not brick setup (idempotent `setupPlayer`)
- [x] Invalid URL surfaces a `PlayerError` / `PlayerException` code

Emulator audio fidelity is still non-authoritative for P0 background QA. Lock-screen / notification QA remains T4+.

**CI residual (T3):** There is no library `gradlew` in-repo. Android `assembleRelease` requires `example` prebuild (`npx expo prebuild --platform android`) then `./gradlew assembleRelease`. That job is not in CI yet (heavy / flaky on ubuntu without a committed native tree). JS/unit/plugin/pack gates remain in CI.

## Next

1. Lock-screen / notification controls (T4–T5)
2. Queue + events (T6)

See [`ROADMAP.md`](../ROADMAP.md).
