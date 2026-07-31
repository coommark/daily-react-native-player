# Silence tracks (core)

First-class queue items used for speech verse pauses and ambient loop-all gaps in
**[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Public helper (planned)

```ts
createSilenceTrack({ durationMs: number, id?: string })
```

Returns an identifiable queue item with exact duration so skip / rate logic can treat it like any other track.

## Native ownership

| Platform | Implementation |
| --- | --- |
| Android | Prefer `SilenceMediaSource` |
| iOS | Cached PCM WAV (**22050 Hz, mono, 16-bit** default — matches Daily Bible Piper TTS) |

No host `expo-file-system` runtime dependency required; cache / cleanup lives in the native module.

## App responsibilities

- Decide when to insert silence (e.g. between verses)
- Force `setRate(1)` on silence items if slow speech rate must not stretch pause WAVs (Bible policy)
