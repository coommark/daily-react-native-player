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
const asset = Image.resolveAssetSource(require('./assets/sample.wav'));
await add({ url: asset.uri });
await play();

await seekTo(10);
const { position, duration } = await getProgress();
const state = await getPlaybackState();
await pause();
await reset();
```

See [`api.md`](./api.md) for URI rules, errors, and single-source `add` semantics.

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

The example depends on `daily-react-native-player` via `file:..` (npm-consumer style) and lists the config plugin in `app.json`. After prebuild, verify injections with `yarn assert:prebuild` from the repo root.

### T3 smoke checklist

- [ ] Android: local WAV play/pause/seek
- [ ] Android: remote progressive play/pause/seek
- [ ] iOS: same
- [ ] `reset` then load again works
- [ ] Fast Refresh does not brick setup (idempotent `setupPlayer`)
- [ ] Invalid URL surfaces a `PlayerError` / `PlayerException` code

Emulator audio fidelity is non-authoritative. Lock-screen / notification QA is T4+.

**CI residual (T3):** There is no library `gradlew` in-repo. Android `assembleRelease` requires `example` prebuild (`npx expo prebuild --platform android`) then `./gradlew assembleRelease`. That job is not in CI yet (heavy / flaky on ubuntu without a committed native tree). Run locally after prebuild before relying on release/minify. JS/unit/plugin/pack gates remain in CI.

**Device smoke residual (T3):** Automated CI cannot exercise real audio I/O. Run the example smoke checklist above on at least one Android and one iOS runtime after `yarn build` + prebuild/dev-client before treating progressive playback as verified on device.

## Next

1. Lock-screen / notification controls (T4–T5)
2. Queue + events (T6)

See [`ROADMAP.md`](../ROADMAP.md).
