# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(0.x: breaking changes may ship with a CHANGELOG entry; hosts should pin).

## [0.1.0] — 2026-08-08

### Fixed

- iOS: `SpeechEngine.configureAudioSession()` no longer passes `.allowBluetooth` /
  `.allowBluetoothA2DP` / `.allowAirPlay` with category `.playback` (OSStatus -50 /
  paramErr on iOS 26+). Playback routes stay automatic; only `.duckOthers` is set
  when ambient ducking is active.

### Added

- Expo Module (New Architecture only) speech player for Expo SDK **57+** / RN **0.86+**
- P0 background playback: Android `MediaSessionService` + FGS `mediaPlayback`, iOS Now Playing / remotes
- `registerPlaybackService` + emit-only Remote* events to JS
- Speech queue API (add/remove/skip/seek/rate) + Playback* events
- Native silence tracks (`createSilenceTrack` / Android `SilenceMediaSource` / iOS cached PCM WAV)
- HLS VOD + seek-after-ready
- Opt-in ambient dual-audio (lazy; never owns focus or Now Playing)
- Config plugin for iOS audio background mode + Android FGS / service declaration
- Runtime contracts: setup coalesce + 10s `setup_timeout`, bounded native main hops, FGS sync promotion, reset play-intent-first
- Optional `debug` player option for verbose logs
- `getPlaybackState()` returns `{ state }` (host-compatible)
- `PlaybackProgressUpdated.track` active queue index (or `null`)
- `State.Buffering` / `State.Stopped` vocabulary aliases; `TrackType` const (`Default` / `HLS` / `Silence`)
- `setPlayWhenReady(true)` may be armed before the first `add` (progressive TTS); `play()` still requires a source
- `queueEpoch` bumps only on active-media replace / reset (not progressive append), so pause-track enqueue cannot starve progress
- Silence WAV materialize is async-prewarm on add; sync ensure stays on activate
- Android: `updateMetadataForTrack` / `updateNowPlayingMetadata` / artwork apply use `replaceMediaItem` only (no `setMediaItem`+`prepare`), fixing verse-start stutter when hosts sync Now Playing on every track change
- Docs: ADR-19/20 + host integration notes from Daily Bible wiring (`getting-started`, `architecture`, `silence-tracks`)

### Deferred

- Buffer knobs (engine defaults; Phase 2)
- Public `stop()` / `destroy()` APIs

[0.1.0]: https://github.com/coommark/daily-react-native-player/releases/tag/v0.1.0
