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
- Remotes delivered to JS via `registerPlaybackService` (**T5**; T4 uses native Play/Pause/Stop defaults)
- `updateOptions` re-applied after `reset()` so remotes / notification config stay alive

## Config plugin (T2 — done)

CNG / Expo prebuild hosts add:

```json
{
  "expo": {
    "plugins": ["daily-react-native-player"]
  }
}
```

Optional escape hatch: `{ "enableBackgroundPlayback": false }` skips iOS audio mode, Android FGS permissions, and the service declaration. Speech transport still works; Android MediaSession / FGS is skipped.

### Ownership

| Concern | Owner |
| --- | --- |
| `PlaybackService` Kotlin class + Media3 deps | Library AAR |
| `<service>` + FGS / `POST_NOTIFICATIONS` permissions | Config plugin (app manifest) |
| `UIBackgroundModes: audio` | Config plugin (Info.plist) |
| Library `AndroidManifest.xml` | Empty of FGS/service (avoids unwanted merge into every consumer) |
| `MediaSession` + FGS start | T4 — `SessionHolder` + `SpeechEngine` player |
| iOS Now Playing / remotes | T4 — `NowPlayingController` |

`UIBackgroundModes: audio` alone does **not** play audio in background until the player sets an appropriate `AVAudioSession` category. T3 sets `.playback` + `.spokenAudio` on `setupPlayer`.

### Runtime host duties

- On Android 13+, **request `POST_NOTIFICATIONS` at runtime** before expecting a visible media notification (plugin only *declares* the permission).
- Hosts targeting **API 34+** must keep FGS type `mediaPlayback` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (injected by the plugin).
- Prefer **https** artwork URIs (ATS / cleartext). Artwork load failures must not break playback.
- Do not run a second focus-owning media session / FGS for the same playback role.

### Bare workflow (no CNG)

Apply the same Info.plist / AndroidManifest entries manually:

**iOS Info.plist**

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

**AndroidManifest.xml** (inside `<manifest>` / `<application>`)

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<service
  android:name="expo.modules.dailyreactnativeplayer.PlaybackService"
  android:exported="true"
  android:foregroundServiceType="mediaPlayback"
  android:stopWithTask="false">
  <intent-filter>
    <action android:name="androidx.media3.session.MediaSessionService" />
  </intent-filter>
</service>
```

`android:exported="true"` is the T4 default (Media3 / system controller binding). Optionally probe `false` on device later; only change if lock-screen controls still work and docs/tests are updated.

## T4 implementation contract

- Android: unique-id `MediaSession` attached to `SpeechEngine` ExoPlayer; `PlaybackService` hosts FGS / media notification via Media3 (`onUpdateNotification` / synchronous `startForeground` within OS deadline). No fake bootstrap player. No FGS from `BOOT_COMPLETED`.
- iOS: `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` on the shared speech player.
- Kill policy: `appKilledPlaybackBehavior` — `ContinuePlayback` (Bible default) | `PausePlayback` | `StopPlaybackAndRemoveNotification`; `stopForegroundGracePeriod` (default 5s).
- Remotes (T4): Play / Pause / Stop → native engine. Next / Previous visible when enabled, **no-op** until T5/T6.
- `reset()` clears source + now-playing display; keeps session, remotes, and persisted options.

See ownership / kill matrix in [`architecture.md`](./architecture.md).

## Device QA matrix (T4)

Emulator audio is weak signal. Physical Android (Pixel API 34/35 + one OEM) + physical iOS required before calling T4 **done** on the roadmap.

**Packaging gate (automated — passed with T4 implementation):** PrivacyInfo + MediaPlayer/AVFoundation podspec; R8 keeps; `exported=true` documented; New Arch guard; CI build-before-plugin-tests; NativeModule types; `pack:check` includes PrivacyInfo.

| Case | Android Pixel | Android OEM | iOS |
| --- | --- | --- | --- |
| Screen-off audio | | | |
| Lock screen + shade metadata / artwork / progress | | | |
| Play / Pause / Stop remotes | | | |
| Next / Prev visible, no crash | | | |
| Recents swipe + ContinuePlayback | | | N/A |
| Grace pause / resume | | | NP elapsed |
| Deny `POST_NOTIFICATIONS` | | — | N/A |
| Forced `updateNowPlayingMetadata` | | | |
| `reset` → `updateOptions` → `add` | | | |
| Relaunch no zombie session | | | |
| T3 transport still works in example | | | |

Record date, devices, and pass/fail when QA completes.

After example `npx expo prebuild`, run `yarn assert:prebuild` from the repo root to verify injected modes / FGS / service / `stopWithTask`.
