# Background playback (P0)

Non-negotiable for v0.1 / Bible-ready release — required by
**[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Must work on device

- Audio continues when app is backgrounded / screen off
- Android foreground service type `mediaPlayback` + continue-after-kill policy
- iOS `UIBackgroundModes: audio`
- Lock-screen and notification controls: play, pause, stop, next, previous
- Now-playing artifacts: title, artist, album, artwork, duration / position, app / session activity
- Remotes delivered to JS via `registerPlaybackService`
- `updateOptions` re-applied after `reset()` so remotes / notification config stay alive

## Implementation notes (planned)

- Android: `MediaSessionService` + unique session id per process
- iOS: `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter`
- Config plugin injects permissions / service / background modes for Expo prebuild hosts
- Synchronous `startForeground` within OS deadline when started as FGS

## QA

Emulator audio is weak signal. Physical Android (incl. low-end) + physical iOS required before calling T4/T5 done.
