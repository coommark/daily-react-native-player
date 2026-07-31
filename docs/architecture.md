# Architecture

High-level design for `daily-react-native-player`. Decisions below are binding unless superseded in this file.

## Primary product

Built first for **[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Architecture and acceptance criteria track that app’s real playback needs; community features stay secondary until Bible-ready 0.1.0.

## North star

One native audio owner (Expo Module) for speech queue + optional ambient. Background playback with lock-screen / notification controls and now-playing metadata is **P0**.

```text
example app → JS Player / Silence / Ambient(opt) → Expo Module
  Android: MediaSessionService + ExoPlayer (+ SilenceMediaSource) + lazy ambient ExoPlayer
  iOS: AVAudioSession + owned AV queue + MPNowPlaying / remotes + lazy ambient AVPlayer
```

## ADRs (summary)

| ADR | Decision |
| --- | --- |
| 1 | Expo Modules API + config plugin (CNG / prebuild hosts) |
| 2 | Own Media3 + AVFoundation — no third-party audio kit deps |
| 3 | `MediaSessionService` + `MediaSession` (not MediaLibrary) |
| 4 | Unique MediaSession id per process; no leaky bootstrap player |
| 5 | Remotes → JS via `registerPlaybackService` (Android headless task) |
| 6 | Silence = first-class queue items; native-owned sources |
| 7 | Ambient consumer-opt-in + lazy; required for Bible-ready 0.1.0 |
| 8 | P0 background / metadata gates v0.1 device QA |
| 9 | HLS only in v0.1 |
| 10 | Peers: Expo 53+ / RN 0.79+ / New Arch only |
| 11 | Playback rate limits are app policy; player supports general `setRate` |

## Layers

- **JS:** imperative API, events, silence helpers, optional ambient facade
- **Config plugin:** iOS `audio` background mode; Android FGS + service declaration
- **Native:** long-lived media service / session; speech focus owner; ambient never requests focus

Detail expands as tickets land. See also `docs/background-playback.md` and `docs/dual-audio.md`.
