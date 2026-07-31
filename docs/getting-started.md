# Getting started

> Scaffold stage — runtime player APIs are not implemented yet beyond the Expo module stub.

**Primary host app:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Requirements

- New Architecture enabled
- Expo SDK 53+ / React Native 0.79+
- iOS and/or Android device or simulator (device required later for P0 background QA)

## Import

```ts
import Player from 'daily-react-native-player';
```

## Local development

From the repo root:

```bash
yarn
yarn build
cd example
yarn start
```

Native runs:

```bash
cd example
yarn ios
# or
yarn android
```

The example app autolinks the parent module (`expo.autolinking.nativeModulesDir`) and resolves `daily-react-native-player` like an npm consumer.

## Next

1. Config plugin for background audio (T2)
2. Local file playback (T3)
3. Lock-screen / notification controls (T4–T5)

See [`ROADMAP.md`](../ROADMAP.md).
