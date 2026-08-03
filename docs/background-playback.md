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

## Config plugin (T2 — done)

CNG / Expo prebuild hosts add:

```json
{
  "expo": {
    "plugins": ["daily-react-native-player"]
  }
}
```

Optional escape hatch: `{ "enableBackgroundPlayback": false }` skips iOS audio mode, Android FGS permissions, and the service declaration.

### Ownership

| Concern | Owner |
| --- | --- |
| `PlaybackService` Kotlin class + Media3 deps | Library AAR |
| `<service>` + FGS / `POST_NOTIFICATIONS` permissions | Config plugin (app manifest) |
| `UIBackgroundModes: audio` | Config plugin (Info.plist) |
| Library `AndroidManifest.xml` | Empty of FGS/service (avoids unwanted merge into every consumer) |

`UIBackgroundModes: audio` alone does **not** play audio in background until the player sets an appropriate `AVAudioSession` category. T3 sets `.playback` + `.spokenAudio` on `setupPlayer`. Lock-screen remotes / FGS start remain T4.

### Runtime host duties

- On Android 13+, **request `POST_NOTIFICATIONS` at runtime** before expecting a visible media notification (plugin only *declares* the permission; T4 shows the notification).
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

## Implementation notes

- Android: `PlaybackService` is an inert `MediaSessionService` shell (no ExoPlayer). Speech audio lives in `SpeechEngine`. T4 attaches a unique-id `MediaSession` to that player and starts FGS.
- iOS: session category set in T3; `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` = T4
- Synchronous `startForeground` within OS deadline when started as FGS = T4

## QA

Emulator audio is weak signal. Physical Android (incl. low-end) + physical iOS required before calling T4/T5 done.
After example `npx expo prebuild`, run `yarn assert:prebuild` from the repo root to verify injected modes / FGS / service.
