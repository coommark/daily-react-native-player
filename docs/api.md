# API

> Stub. Public surface will grow ticket-by-ticket. Keep this file in sync with exports.

Primary host: [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Current (scaffold smoke — temporary)

```ts
import DailyReactNativePlayer from 'daily-react-native-player';
```

The module currently exports the Expo template stub (`PI`, `hello`, `setValueAsync`, `onChange`).
These exist only to verify native linking. They are **not** the product API and will be replaced
when transport / queue land (T3+). Prefer the target surface below for app design.

Target surface (see [`bible-acceptance.md`](./bible-acceptance.md)):

- Lifecycle: `setupPlayer`, `updateOptions`, `reset`, `registerPlaybackService`
- Queue / transport / metadata / events
- `createSilenceTrack` (core)
- Ambient methods (opt-in)

## Types

TypeScript types live under `src/` and are published via `build/`.
