# daily-react-native-player

**The Expo-native background audio engine for React Native.**

Queue. Lock screen. Notification remotes. Now-playing metadata. HLS. Silence gaps. Optional speech + ambient dual-audio.  
One native owner. New Architecture only. **MIT.**

Built in production for **[Daily Bible - Offline & Audio](https://dailybiblenow.com)** — not a demo toy, a player that has to survive real users, real OEMs, and real background sessions.

| | |
| --- | --- |
| Google Play | [Daily Bible - Offline & Audio](https://play.google.com/store/apps/details?id=com.coommark.dailybible) |
| App Store | [Daily Bible - Offline & Audio](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448) |

---

## Why this player

Most React Native audio stacks were born as **music apps**: heavyweight session models, optional Expo as an afterthought, and features you pay for in complexity whether you need them or not.

**daily-react-native-player** flips that.

| You get | Why it matters |
| --- | --- |
| **Expo-first + config plugin** | Continuous prebuild / CNG hosts get iOS audio background mode and Android `mediaPlayback` FGS wired at `prebuild` — not a checklist of manual native edits |
| **New Architecture only** | No legacy bridge tax. Built for Expo SDK 57+ / RN 0.86+ |
| **Background is P0, not a footnote** | Screen-off playback, lock-screen + notification controls, full now-playing artifacts, continue-after-kill — device-verified before we call it done |
| **One native audio owner** | Media3 (Android) + AVFoundation (iOS). No second focus-owning library bolted on for “ambient” |
| **Speech-grade queue** | Progressive mutation, silence as first-class tracks, rate that doesn’t stretch your pauses — designed for narration, Bible, podcasts, lessons |
| **Ambient when you want it** | Lazy dual-audio under speech: never requests focus, never steals Now Playing; speech-only apps never pay the cost |
| **Formats that ship** | Local + remote **WAV**, **mp3**, **m4a**, other platform progressive codecs; **HLS** with seek-after-ready |
| **MIT, no license drama** | Use it in commercial apps. Fork it. Ship it. |

If your app talks, reads scripture, teaches, or streams spoken content in the background — this is the player you wish existed years ago.

---

## Feature highlights

### Lock screen & notification control (P0)

Play, pause, stop, next, previous from lock screen and the media notification. Title, artist, album, artwork, duration, and position that actually update. Remotes land in JS via `registerPlaybackService` so **your** product logic owns skip (verses, chapters, lessons) — not a dumb queue index.

### Queue that survives real apps

Add, insert, remove, skip, seek. Events you can bind UI to: active track, state, progress, queue ended, errors, remote duck / play / pause / next / previous. Built for **append-while-playing** (TTS pipelines, progressive chapter loads).

### Silence tracks (core, not a hack)

```ts
createSilenceTrack({ durationMs: 800 })
```

Native-owned exact-duration gaps — Android `SilenceMediaSource`, iOS cached PCM WAV — so verse pauses and ambient loop gaps behave like real queue items (skip, rate, metadata) instead of fragile timers.

### Ambient dual-audio (opt-in)

Bed music under speech without crackle, without stealing audio focus, without hijacking the lock screen. Fade, volume, loop-one / loop-all. Lazy init: if you never call ambient APIs, the second player **never exists**.

### Streaming & files

- Progressive: **WAV**, **mp3**, **m4a** (AAC), plus other codecs Media3 / AVFoundation decode  
- Adaptive: **HLS** (seek-after-ready)  
- Explicitly out of v0.1: DASH, SmoothStreaming, Cast, Android Auto browse, web player

---

## Status

**T5 `registerPlaybackService` landed.** Remotes are emit-only to JS (fail-closed). **Physical device QA** still required for T4 session artifacts + T5 remotes→JS before calling P0 background fully done.

| Area | Status |
| --- | --- |
| Expo module + example app | Done (New Arch) |
| Config plugin (iOS audio BG + Android FGS) | Done (T2) |
| Local WAV + progressive mp3 / m4a | Done (T3) |
| Background / lock-screen / notification session | Code complete (T4) — device QA pending |
| `registerPlaybackService` + Remote* → JS | Done (T5) — device QA pending |
| Queue + Playback* events | Planned (T6) |
| Silence tracks | Planned (core / T7) |
| HLS | Planned (T9; seek-after-ready) |
| Ambient dual-audio | Planned (opt-in; required for Bible-ready 0.1.0) |

See [`ROADMAP.md`](./ROADMAP.md). Star the repo and watch releases if you want the first Bible-ready cut.

---

## Who it’s for

- **Expo / CNG apps** that need background audio without hand-maintaining native projects  
- **Speech & narration** products (Bible, meditation, language learning, audiobooks, courses)  
- Teams who want **MediaSession done right** without MediaLibrary / Auto / Cast bloat  
- Anyone who needs **MIT** background audio with a clear acceptance matrix ([`docs/bible-acceptance.md`](./docs/bible-acceptance.md))

## Who should look elsewhere (for now)

- Old Architecture / legacy bridge hosts  
- Apps that need Android Auto browse trees, Cast, DASH, or a web player in v0.1  
- Pure in-app UI sound effects with no background / remotes requirement

---

## Requirements

- **New Architecture** only (mandatory on Expo SDK 57+)
- **Expo SDK 57+** (Expo Modules Core required) / React Native **0.86+** (primary host: Daily Bible - Offline & Audio)
- Hosts on Expo &lt;57 must upgrade the app before installing this package
- iOS + Android (web transport unsupported)

---

## Install (when published)

```bash
npx expo install daily-react-native-player
```

```ts
// index.ts — remotes require registerPlaybackService before root
import { registerPlaybackService, setupPlayer, add, play } from 'daily-react-native-player';
import { registerRootComponent } from 'expo';
import App from './App';
import { playbackService } from './playbackService';

registerPlaybackService(() => playbackService);
registerRootComponent(App);
```

Add the config plugin so prebuild injects iOS `audio` background mode and Android media foreground-service permissions / `MediaSessionService`:

```json
{
  "expo": {
    "plugins": ["daily-react-native-player"]
  }
}
```

Optional: `{ "enableBackgroundPlayback": false }` disables those injections. See [`docs/background-playback.md`](./docs/background-playback.md) for bare-workflow XML and the Android 13+ `POST_NOTIFICATIONS` runtime requirement.

---

## Develop locally

```bash
yarn
yarn build
# while editing the package TS: npx tsc --watch
cd example
yarn start
```

Run on devices with `yarn ios` / `yarn android` from `example/` (dev client / prebuild).  
**Emulators lie about audio.** Physical Android (including low-end) + physical iOS are the bar for background / remotes.

---

## Documentation

- [Getting started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md) — ADRs (Expo Module, MediaSessionService, silence, ambient)
- [API](./docs/api.md)
- [Background playback (P0)](./docs/background-playback.md)
- [Silence tracks](./docs/silence-tracks.md)
- [Dual audio / ambient](./docs/dual-audio.md)
- [Bible acceptance matrix](./docs/bible-acceptance.md)
- [Contributing](./docs/contributing.md)

---

## License

**MIT** — see [LICENSE](./LICENSE). Ship commercially. Contribute freely.

Built for [Daily Bible - Offline & Audio](https://dailybiblenow.com)  
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

**Background audio that respects Expo, speech apps, and your users’ lock screens.**
