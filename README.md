# daily-react-native-player

**The Expo-native background audio engine for React Native.**

**Multi-track speech playlist.** Lock screen, notification & Bluetooth remotes. Now-playing metadata. HLS. Silence gaps. Optional speech + ambient dual-audio.  
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
| **Speech playlist, not a single URL** | Load a chapter of verses (or a whole lesson) as a real queue — append, insert, remove, skip — while audio keeps playing |
| **Lock screen, notification & Bluetooth control** | Play / pause / stop / next / previous from the lock screen, media notification, Control Center, wired & Bluetooth headsets, car decks — without keeping the app open |
| **Your policy on remotes** | Hardware buttons emit to JS via `registerPlaybackService` — Bible maps Next to the next *verse*, not a dumb playlist index |
| **Expo-first + config plugin** | Continuous prebuild / CNG hosts get iOS audio background mode and Android `mediaPlayback` FGS wired at `prebuild` — not a checklist of manual native edits |
| **New Architecture only** | No legacy bridge tax. Built for Expo SDK 57+ / RN 0.86+ |
| **Background is P0, not a footnote** | Screen-off playback, full now-playing artifacts (title, artist, album, artwork), continue-after-kill — device-verified before we call it done |
| **One native audio owner** | Media3 (Android) + AVFoundation (iOS). No second focus-owning library bolted on for “ambient” |
| **Events your UI can trust** | Active track, state, progress, queue ended, errors — same stack that powers remotes |
| **Ambient when you want it** | Lazy dual-audio under speech: never requests focus, never steals Now Playing; speech-only apps never pay the cost |
| **Formats that ship** | Local + remote **WAV**, **mp3**, **m4a**, other platform progressive codecs; **HLS** with seek-after-ready |
| **MIT, no license drama** | Use it in commercial apps. Fork it. Ship it. |

If your app talks, reads scripture, teaches, or streams spoken content in the background — this is the player you wish existed years ago.

---

## Feature highlights

### Lock screen, notification & Bluetooth remotes (P0 — shipped)

Users do not live inside your React tree. They control audio from the **lock screen**, the **media notification**, **Control Center / Dynamic Island**, and **Bluetooth / wired headsets** (and car decks that speak MediaSession / MPRemoteCommandCenter).

That stack is **non-negotiable** here — the same path Daily Bible relies on in the wild:

| Surface | What users get |
| --- | --- |
| Lock screen | Play, pause, stop, next, previous + title / artist / album / artwork |
| Notification shade (Android) | Same controls while the phone is in a pocket |
| Headsets & Bluetooth | Play/pause, next/previous from the buds or car without unlocking |
| Screen off / background | Audio keeps going; Android FGS `mediaPlayback` + iOS audio background mode |
| App killed (configurable) | `ContinuePlayback` keeps the session alive (Bible default) |

Remotes are **emit-only to JavaScript** via `registerPlaybackService` (headless on Android). Your service decides policy — e.g. Next means next *verse*, not “whatever Media3 thinks”:

```ts
// index.ts — before registerRootComponent
registerPlaybackService(() => async () => {
  addEventListener(Event.RemotePlay, () => void play());
  addEventListener(Event.RemotePause, () => void pause());
  addEventListener(Event.RemoteNext, () => void skipToNext()); // or your verse logic
  addEventListener(Event.RemotePrevious, () => void skipToPrevious());
});
```

Full now-playing metadata (forced overrides when raw WAV tags lie), seek scrubber stays native. Config plugin injects the FGS / `UIBackgroundModes` wiring at prebuild.

Deep dive: [`docs/background-playback.md`](./docs/background-playback.md) · API remotes: [`docs/api.md`](./docs/api.md)

### Multi-track speech playlist (shipped)

This is the heart of a narration app: **not** one file at a time, but a **playlist of speech tracks** that auto-advances, accepts appends mid-play, and tells your React tree what changed.

```ts
await setupPlayer({ progressUpdateEventInterval: 1 });

await add([
  { url: verse1, title: 'Genesis 1:1' },
  { url: verse2, title: 'Genesis 1:2' },
  { url: verse3, title: 'Genesis 1:3' },
]);

addEventListener(Event.PlaybackActiveTrackChanged, ({ index, track }) => {
  // Sync “now reading” UI
});

await play();
await skipToNext();
```

- **Add / insert / remove / skip** with stable track `id`s  
- **Playback\* events** — active track, state, ~1s progress, queue ended, errors  
- **Lock-screen / Bluetooth Next/Previous** → JS → you call `skip*` (product logic stays yours)  
- Built for **chapter-scale** queues (native prepare window)

Deep dive: [`docs/queue.md`](./docs/queue.md) · API: [`docs/api.md`](./docs/api.md)

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

**Lock-screen / notification / Bluetooth remotes (T4–T5) and speech playlist + Playback\* events (T6) are in the package.** Remotes are emit-only to JS; the example wires Play/Pause/Next/Prev. **Physical device QA** is still required before calling the full P0 background matrix “done.”

| Area | Status |
| --- | --- |
| Expo module + example app | Done (New Arch) |
| Config plugin (iOS audio BG + Android FGS) | Done (T2) |
| Local WAV + progressive mp3 / m4a | Done (T3) |
| **Lock screen / notification / Now Playing session** | **Code complete (T4)** — device QA pending |
| **`registerPlaybackService` + Remote\* → JS (headsets & lock screen)** | **Done (T5)** — device QA pending |
| **Multi-track playlist + Playback\* events** | **Done (T6)** |
| Silence tracks | Planned (core / T7) |
| HLS | Planned (T9; seek-after-ready) |
| Ambient dual-audio | Planned (opt-in; required for Bible-ready 0.1.0) |

See [`ROADMAP.md`](./ROADMAP.md). Star the repo and watch releases if you want the first Bible-ready cut.

---

## Who it’s for

- **Expo / CNG apps** that need background audio without hand-maintaining native projects  
- **Speech & narration** products (Bible, meditation, language learning, audiobooks, courses) that need a **real playlist** *and* lock-screen / Bluetooth control  
- Teams who want **MediaSession / Now Playing done right** — without MediaLibrary / Auto / Cast bloat  
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
import {
  registerPlaybackService,
  setupPlayer,
  add,
  play,
  Event,
  addEventListener,
} from 'daily-react-native-player';
import { registerRootComponent } from 'expo';
import App from './App';
import { playbackService } from './playbackService';

registerPlaybackService(() => playbackService);
registerRootComponent(App);

// Later in app code:
await setupPlayer();
await add([
  { url: 'https://example.com/a.mp3', title: 'Track 1' },
  { url: 'https://example.com/b.mp3', title: 'Track 2' },
]);
addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
  console.log('now playing', track?.title);
});
await play();
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
The example includes **Load multi-track queue**, skip next/previous, and remotes → `skip*`.  
**Emulators lie about audio.** Physical Android (including low-end) + physical iOS are the bar for **lock screen, notification, Bluetooth remotes, and background**.

---

## Documentation

- [Getting started](./docs/getting-started.md)
- [**Background playback & remotes (P0)**](./docs/background-playback.md) — lock screen, notification, Bluetooth, Now Playing, `registerPlaybackService`
- [**Speech queue / playlist**](./docs/queue.md) — multi-track API, events, remotes → skip*
- [Architecture](./docs/architecture.md) — ADRs (Expo Module, MediaSessionService, queue, silence, ambient)
- [API](./docs/api.md)
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

**Background audio that respects Expo, speech playlists, lock screens, and Bluetooth remotes.**
