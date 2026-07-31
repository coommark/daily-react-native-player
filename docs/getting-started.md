# Getting started

> Scaffold stage — runtime player APIs are not implemented yet beyond the Expo module stub
> (`hello` / `PI` / `setValueAsync` are temporary linking smoke; see [`api.md`](./api.md)).

**Primary host app:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Requirements

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

## Next

1. Local / progressive file playback (T3)
2. Lock-screen / notification controls (T4–T5)

See [`ROADMAP.md`](../ROADMAP.md).
