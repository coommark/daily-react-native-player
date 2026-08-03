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
| 9 | Progressive WAV/mp3/m4a (+ platform codecs) from T3; HLS streaming only (no DASH/SS) in v0.1 |
| 10 | Peers: Expo 53+ / RN 0.79+ / New Arch only |
| 11 | Playback rate limits are app policy; player supports general `setRate` |

## Layers

- **JS:** imperative Player API (named exports), silence helpers (T7), optional ambient facade (T10)
- **Config plugin (T2):** plugin-owned iOS `UIBackgroundModes: audio` + Android FGS permissions + `PlaybackService` declaration in the *app* manifest (`createRunOncePlugin`, `enableBackgroundPlayback` escape hatch). Library AAR owns the Kotlin `PlaybackService` class and pinned Media3 deps; library manifest stays free of FGS/service. No auto-start / FGS until T4.
- **Native (T3):** process-scoped `SpeechEngine` owns the speech player (Android ExoPlayer Media3 **1.8.0**, iOS AVPlayer). Mutations are serialized (Android player looper / main; iOS main via AsyncFunction). `OnDestroy` releases the engine; `reset()` clears source only. `PlaybackService` is an **inert shell** (no ExoPlayer) until T4 attaches `MediaSession` to `SpeechEngine.getPlayer()`. Dual players are forbidden.
- **Audio policy (T3):** Android `USAGE_MEDIA` + `CONTENT_TYPE_SPEECH`; iOS `AVAudioSession` category `.playback`, mode `.spokenAudio`, Bluetooth/AirPlay options. Full mix-mode / remotes = later tickets.

Detail expands as tickets land. See also `docs/background-playback.md` and `docs/dual-audio.md`.
