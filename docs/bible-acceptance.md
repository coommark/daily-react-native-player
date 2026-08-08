# Bible acceptance matrix

API and behavior **[Daily Bible - Offline & Audio](https://dailybiblenow.com)** requires before migration
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Keep contract tests aligned with this list.

## Lifecycle

- [x] `registerPlaybackService`
- [x] `setupPlayer` (idempotent; treat already-initialized as success)
- [x] `updateOptions`
- [x] `reset` then re-apply options (remotes / notification) — options persist across `reset`; re-`updateOptions` also supported

## Queue

Speech **playlist** used for chapter / verse sequences — see [`queue.md`](./queue.md).

- [x] `add` (append + insert at index)
- [x] `remove`
- [x] `getQueue` / `getActiveTrack` / `getActiveTrackIndex`

## Transport

- [x] `play` / `pause`
- [x] `skip` / `skipToNext` / `skipToPrevious`
- [x] `seekTo`
- [x] `setPlayWhenReady` / `getPlayWhenReady`
- [x] `getPlaybackState` / `getProgress`
- [x] `setRate` (app may clamp; pause/silence tracks use rate 1)

## Metadata

- [x] `updateNowPlayingMetadata`
- [x] `updateMetadataForTrack` — any in-range index
- [x] Forced metadata overrides file tags when needed

## Events

- [x] `PlaybackActiveTrackChanged`
- [x] `PlaybackState`
- [x] `PlaybackQueueEnded`
- [x] `PlaybackError`
- [x] `PlaybackProgressUpdated` (~1s interval configurable)
- [x] `PlaybackPlayWhenReadyChanged`
- [x] `RemoteDuck`
- [x] `RemotePlay` / `RemotePause` / `RemotePlayPause` / `RemoteStop` / `RemoteNext` / `RemotePrevious`

## Setup options used by Bible

- [x] Capabilities: Play, Pause, Stop, SkipToNext, SkipToPrevious
- [x] `progressUpdateEventInterval`
- [x] Android `appKilledPlaybackBehavior: ContinuePlayback`, `stopForegroundGracePeriod`
- [x] `androidAudioContentType: Speech` — via T3 engine attributes (Speech)
- [x] `androidAudioMixMode: 'default' | 'duckOthers'`
- [x] iOS Playback + SpokenAudio + DuckOthers + Bluetooth + AirPlay — Playback/SpokenAudio/BT/AirPlay from T3; DuckOthers = T10 mix
- [ ] Buffer knobs
- [x] `autoHandleInterruptions: false` — emit `remote-duck` only; no auto pause/resume when false
- [x] `autoUpdateMetadata: true`

## Sources

- [x] Local / remote progressive URLs: WAV, mp3, m4a (AAC), plus other codecs Media3 / AVFoundation decode (T3)
- [x] HLS (`TrackType.HLS` / `'hls'`)
- [x] Seek-after-ready for HLS

## Silence (core)

- [x] `createSilenceTrack` / `isSilenceTrack` queueable silence items (T7)
- [x] Exact duration; usable between speech items (ambient gaps reuse the same helper in T10)

See [`silence-tracks.md`](./silence-tracks.md) for product uses.

## Ambient (opt-in; required for Bible-ready)

- [x] `ambientSetPlaylist` / `ambientPlay` / `ambientPause` / `ambientStop`
- [x] `ambientSetVolume` / `ambientFade`
- [x] Lazy init; speech-only never creates ambient player

## Explicitly out of player scope

- TTS / Sherpa / ONNX
- `verse_timings` (app/session)
- Hymn asset install, sleep timer UI
- Playback rates product clamp (0.75–1.0 stays in app)
