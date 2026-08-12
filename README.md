# daily-react-native-player

**The edge-native background audio engine for Expo — TTS, playlists, HLS, dual-track ambient. MIT.**

[![npm version](https://img.shields.io/npm/v/daily-react-native-player.svg)](https://www.npmjs.com/package/daily-react-native-player)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Expo SDK 57+](https://img.shields.io/badge/Expo-SDK%2057%2B-000020)](https://expo.dev)
[![New Architecture](https://img.shields.io/badge/New%20Architecture-only-4630EB)](https://reactnative.dev/docs/the-new-architecture/landing-page)

Lock screen. Notification. Bluetooth remotes. A real playlist — not a single URL. Native silence gaps. Optional speech + ambient on one native owner.

Built in production for **[Daily Bible - Offline & Audio](https://dailybiblenow.com)** — the Bible app that has to keep playing when the phone is in a pocket, the screen is off, and the next verse is already in the queue.

| | |
| --- | --- |
| Google Play | [Daily Bible - Offline & Audio](https://play.google.com/store/apps/details?id=com.coommark.dailybible) |
| App Store | [Daily Bible - Offline & Audio](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448) |

---

## Built for

**Edge-native TTS & narration.** Progressive queue append at verse or chapter scale. Silence as a first-class track. Pitch-preserving `setRate`. HLS with seek-after-ready. This is the player layer your on-device TTS pipeline plugs into — you generate URLs; we play them in the background.

**Music & playlist apps.** A real queue: add, insert, remove, skip while audio keeps going. Lock-screen and headset remotes. Now Playing artwork. Continue-after-kill when you want the session to survive.

**[Daily Bible - Offline & Audio](https://dailybiblenow.com).** Flagship host. Speech playlist plus an ambient bed that never steals Now Playing and never requests audio focus.

If your app talks, sings, teaches, or streams in the background on Expo — this is the engine.

---

## Features

- **Lock screen, notification, Control Center, Bluetooth** — play / pause / stop / next / previous from the surfaces users actually touch
- **`registerPlaybackService`** — remotes emit to JS; Next can mean next *verse* or next *song*. Policy stays yours
- **Multi-track playlist** — append mid-playback; stable track ids; Playback\* events your UI can trust
- **HLS VOD** — plus WAV, mp3, m4a; seek before the stream is ready
- **Native silence tracks** — exact-duration gaps as queue items, not timers (`SilenceMediaSource` / cached PCM WAV)
- **Optional ambient dual-audio** — lazy init; never requests focus; never owns Now Playing
- **Expo config plugin** — iOS audio background mode + Android `mediaPlayback` FGS at prebuild
- **New Architecture only** — Media3 (Android) + AVFoundation (iOS). One native audio owner
- **Pitch-preserving `setRate`** — silence stays at 1× so pauses are not stretched
- **Production hardening** — setup coalesce + timeout, FGS sync promotion, reset play-intent-first
- **MIT** — commercial use. No license gate. Fork it. Ship it.

---

## Install

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

**Peers:** Expo SDK **57+** / React Native **0.86+**. New Architecture only. iOS + Android (no web player).

```ts
// index.ts — remotes require registerPlaybackService before root
import {
  registerPlaybackService,
  setupPlayer,
  add,
  play,
  pause,
  skipToNext,
  skipToPrevious,
  Event,
  addEventListener,
} from 'daily-react-native-player';
import { registerRootComponent } from 'expo';
import App from './App';

registerPlaybackService(() => async () => {
  addEventListener(Event.RemotePlay, () => void play());
  addEventListener(Event.RemotePause, () => void pause());
  addEventListener(Event.RemoteNext, () => void skipToNext());
  addEventListener(Event.RemotePrevious, () => void skipToPrevious());
});
registerRootComponent(App);

// Later:
await setupPlayer({ progressUpdateEventInterval: 1 });
await add([
  { url: 'https://example.com/a.mp3', title: 'Track 1', artist: 'Daily Bible' },
  { url: 'https://example.com/b.mp3', title: 'Track 2' },
]);
addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
  console.log('now playing', track?.title);
});
await play();
```

Optional: `{ "enableBackgroundPlayback": false }` skips native injections. Android 13+ still needs `POST_NOTIFICATIONS` at runtime — see [background playback](https://github.com/coommark/daily-react-native-player/blob/main/docs/background-playback.md).

---

## Shipped in 0.1.0

| Capability | Status |
| --- | --- |
| Lock screen / notification / Now Playing | **Done** |
| `registerPlaybackService` + Remote\* → JS | **Done** |
| Multi-track playlist + Playback\* events | **Done** |
| Silence tracks · HLS · Ambient · Hardening (T11/T12) | **Done** |

---

## Who should look elsewhere (for now)

- Old Architecture / legacy bridge hosts
- Apps that need Android Auto browse, Cast, DASH, or a web player in v0.1
- Pure in-app UI sound effects with no background or remotes

---

## Documentation

- [Getting started](https://github.com/coommark/daily-react-native-player/blob/main/docs/getting-started.md)
- [Background playback & remotes](https://github.com/coommark/daily-react-native-player/blob/main/docs/background-playback.md)
- [Speech queue / playlist](https://github.com/coommark/daily-react-native-player/blob/main/docs/queue.md)
- [API](https://github.com/coommark/daily-react-native-player/blob/main/docs/api.md)
- [Silence tracks](https://github.com/coommark/daily-react-native-player/blob/main/docs/silence-tracks.md)
- [Dual audio / ambient](https://github.com/coommark/daily-react-native-player/blob/main/docs/dual-audio.md)
- [Runtime contracts](https://github.com/coommark/daily-react-native-player/blob/main/docs/contracts.md)
- [Architecture](https://github.com/coommark/daily-react-native-player/blob/main/docs/architecture.md)
- [Bible acceptance](https://github.com/coommark/daily-react-native-player/blob/main/docs/bible-acceptance.md)
- [Contributing](https://github.com/coommark/daily-react-native-player/blob/main/docs/contributing.md)
- [Changelog](https://github.com/coommark/daily-react-native-player/blob/main/CHANGELOG.md)

Local development: `yarn && yarn build`, then `cd example && yarn start`. Physical devices are the bar for lock screen, notification, and Bluetooth remotes.

---

## License

**MIT** — see [LICENSE](./LICENSE). Ship commercially. Contribute freely.

Built for **[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

Star the repo. Watch releases. Put background audio on Expo the way Daily Bible ships it.
