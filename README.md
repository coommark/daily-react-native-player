# daily-react-native-player

Expo-first background audio player for React Native (**New Architecture only**).

**Primary product:** this library is developed first and foremost for
**[Daily Bible - Offline & Audio](https://dailybiblenow.com)** — offline Piper TTS,
HLS streaming, lock-screen controls, and optional ambient dual-audio.

| Store | Link |
| --- | --- |
| Google Play | [Daily Bible - Offline & Audio](https://play.google.com/store/apps/details?id=com.coommark.dailybible) |
| App Store | [Daily Bible - Offline & Audio](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448) |

It is also intended as a clean open-source player for the React Native / Expo community.
Features beyond Daily Bible’s needs are secondary until the Bible-ready milestone ships.

## Status

**Pre-MVP / Day 1 scaffold.** Public APIs beyond the Expo module stub are not ready for production.

| Area | Status |
| --- | --- |
| Expo module + example app | Scaffolded |
| Background / lock-screen / notification controls | Planned (P0) |
| Queue + events | Planned |
| Silence tracks | Planned (core) |
| HLS | Planned |
| Ambient dual-audio | Planned (opt-in; required for Bible-ready 0.1.0) |

See [`ROADMAP.md`](./ROADMAP.md).

## Requirements

- **New Architecture** required (`newArchEnabled: true`)
- Expo SDK **53+** / React Native **0.79+** (primary host: Daily Bible - Offline & Audio)
- iOS + Android (no web player in v0.1)

## Install (when published)

```bash
npx expo install daily-react-native-player
```

```ts
import Player from 'daily-react-native-player';
```

Add the config plugin (coming in T2) so prebuild injects iOS audio background mode and Android media foreground-service permissions.

## Develop locally

```bash
yarn
yarn build
cd example
yarn start
```

Run on devices with `yarn ios` / `yarn android` from `example/` (dev client / prebuild).

## Documentation

- [Getting started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [API](./docs/api.md)
- [Background playback (P0)](./docs/background-playback.md)
- [Silence tracks](./docs/silence-tracks.md)
- [Dual audio / ambient](./docs/dual-audio.md)
- [Bible acceptance matrix](./docs/bible-acceptance.md)
- [Contributing](./docs/contributing.md)

## License

MIT — see [LICENSE](./LICENSE).

Built for [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
