# Bible acceptance matrix

API and behavior **[Daily Bible - Offline & Audio](https://dailybiblenow.com)** requires before migration
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Keep contract tests aligned with this list.

## Lifecycle

- [ ] `registerPlaybackService`
- [x] `setupPlayer` (idempotent; treat already-initialized as success)
- [x] `updateOptions`
- [x] `reset` then re-apply options (remotes / notification) — options persist across `reset`; re-`updateOptions` also supported

## Queue

- [ ] `add` (append + insert at index) — T3/T4 ship single-source `add` (replace current item); full queue semantics = T6
- [ ] `remove`
- [ ] `getQueue` / `getActiveTrack` / `getActiveTrackIndex`

## Transport

- [x] `play` / `pause`
- [ ] `skip` / `skipToNext` / `skipToPrevious`
- [x] `seekTo`
- [x] `setPlayWhenReady` / `getPlayWhenReady`
- [x] `getPlaybackState` / `getProgress`
- [ ] `setRate` (app may clamp; pause/silence tracks use rate 1)

## Metadata

- [x] `updateNowPlayingMetadata`
- [x] `updateMetadataForTrack` — index `0` only until T6
- [x] Forced metadata overrides file tags when needed

## Events

- [ ] `PlaybackActiveTrackChanged`
- [ ] `PlaybackState`
- [ ] `PlaybackQueueEnded`
- [ ] `PlaybackError`
- [ ] `PlaybackProgressUpdated` (~1s interval configurable)
- [ ] `PlaybackPlayWhenReadyChanged`
- [ ] `RemoteDuck`
- [ ] `RemotePlay` / `RemotePause` / `RemotePlayPause` / `RemoteStop` / `RemoteNext` / `RemotePrevious`

## Setup options used by Bible

- [x] Capabilities: Play, Pause, Stop, SkipToNext, SkipToPrevious
- [ ] `progressUpdateEventInterval`
- [x] Android `appKilledPlaybackBehavior: ContinuePlayback`, `stopForegroundGracePeriod`
- [x] `androidAudioContentType: Speech` — via T3 engine attributes (Speech)
- [ ] `androidAudioMixMode: 'default' | 'duckOthers'`
- [x] iOS Playback + SpokenAudio + DuckOthers + Bluetooth + AirPlay — Playback/SpokenAudio/BT/AirPlay from T3; DuckOthers = T10 mix
- [ ] Buffer knobs
- [x] `autoHandleInterruptions: false` — stored; no auto-resume in T4
- [x] `autoUpdateMetadata: true`

## Sources

- [x] Local / remote progressive URLs: WAV, mp3, m4a (AAC), plus other codecs Media3 / AVFoundation decode (T3)
- [ ] HLS (`TrackType.HLS` / `'hls'`)
- [ ] Seek-after-ready for HLS

## Silence (core)

- [ ] `createSilenceTrack` / equivalent queueable silence items
- [ ] Exact duration; usable between speech and ambient items

## Ambient (opt-in; required for Bible-ready)

- [ ] `ambientSetPlaylist` / `ambientPlay` / `ambientPause` / `ambientStop`
- [ ] `ambientSetVolume` / `ambientFade`
- [ ] Lazy init; speech-only never creates ambient player

## Explicitly out of player scope

- TTS / Sherpa / ONNX
- `verse_timings` (app/session)
- Hymn asset install, sleep timer UI
- Playback rates product clamp (0.75–1.0 stays in app)
