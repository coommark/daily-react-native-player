# Background playback & system remotes (P0)

Non-negotiable for v0.1 / Bible-ready release — required by
**[Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## What this gives your users

Control audio **without opening the app**:

| Surface | Controls |
| --- | --- |
| **Lock screen** | Play, pause, stop, next, previous + artwork / title / artist / album |
| **Media notification** (Android) | Same while the phone is locked or in a pocket |
| **Control Center / Dynamic Island** (iOS) | System transport + Now Playing |
| **Bluetooth & wired headsets** | Play/pause, next/previous from buds, car decks, and other MediaSession / MPRemote clients |
| **Screen off / background** | Playback continues (Android FGS `mediaPlayback`, iOS `UIBackgroundModes: audio`) |
| **App removed from recents** | Configurable — Bible uses **ContinuePlayback** |

Hardware and system UI do **not** call native transport blindly. They emit **Remote\*** events to your JS `registerPlaybackService` so **product policy** owns Next/Previous (e.g. next verse). That is the T4 session + T5 remote bridge.

## Must work on device

- Audio continues when app is backgrounded / screen off
- Android foreground service type `mediaPlayback` + continue-after-kill policy
- iOS `UIBackgroundModes: audio`
- Lock-screen and notification controls: play, pause, stop, next, previous
- Now-playing artifacts: title, artist, album, artwork, duration / position, app / session activity
- Remotes delivered to JS via `registerPlaybackService` (**T5**) — including headset / Bluetooth command paths that go through MediaSession / MPRemoteCommandCenter
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
- Remotes (T5): Play / Pause / Stop / Next / Previous → **emit-only** to JS (`registerPlaybackService`). Scrubber seek stays native. Headless task key `DailyReactNativePlayer`.
- `reset()` clears source + now-playing display; keeps session, remotes, and persisted options.

See ownership / kill matrix in [`architecture.md`](./architecture.md).

## T5 remote → JS

Hosts **must** register a playback service at entry (before root component):

```ts
import { registerPlaybackService, Event, addEventListener, play, pause } from 'daily-react-native-player';

registerPlaybackService(() => async () => {
  addEventListener(Event.RemotePlay, () => { void play(); });
  addEventListener(Event.RemotePause, () => { void pause(); });
  // …
});
```

Not `expo-background-task`. See [`api.md`](./api.md). Host SLAs: [`contracts.md`](./contracts.md).

### Device QA (T5 additions)

| Case | Android Pixel | Android OEM | iOS |
| --- | --- | --- | --- |
| Remotes → JS while backgrounded | Pending | Pending | Pending |
| One tap → one JS transport action | Pending | Pending | Pending |
| UI play does not emit Remote* | Pending | Pending | Pending |
| Headless task finish leaves FGS alive | Pending | Pending | N/A |
| Missing registration (`__DEV__` warn) | Pending | Pending | Pending |

## Device QA matrix (T4 + T11)

Emulator audio is weak signal. Physical Android (Pixel API 34/35 + one OEM) + physical iOS required before calling T4 / T11 **done** on the roadmap.

**Evidence (fill when signing):**

| Field | Value |
| --- | --- |
| Date (ISO) | |
| Tester | |
| Git SHA | |
| Pixel model + OS | |
| OEM model + OS | |
| iPhone model + iOS | |

**Packaging gate (automated):** PrivacyInfo (no required-reason APIs — FileManager caches only); MediaPlayer/AVFoundation podspec; R8 keeps; `exported=true` documented; New Arch JS guard; CI `assembleRelease`; NativeModule types; `pack:check` excludes android build caches.

| Case | Android Pixel | Android OEM | iOS |
| --- | --- | --- | --- |
| Screen-off audio | Pending | Pending | Pending |
| Lock screen + shade metadata / artwork / progress | Pending | Pending | Pending |
| Play / Pause / Stop remotes | Pending | Pending | Pending |
| Next / Prev visible, no crash | Pending | Pending | Pending |
| Cold start → play → FGS notification (no deadline crash) | Pending | Pending | N/A |
| Recents swipe + ContinuePlayback | Pending | Pending | N/A |
| Grace pause / resume | Pending | Pending | NP elapsed |
| Deny `POST_NOTIFICATIONS` | Pending | — | N/A |
| Forced `updateNowPlayingMetadata` | Pending | Pending | Pending |
| `reset` → options persist → `add` / play | Pending | Pending | Pending |
| Fast Refresh / double `setupPlayer` | Pending | Pending | Pending |
| RemoteStop pause→reset → re-add → play | Pending | Pending | Pending |
| Ambient under speech (NP = speech); speech reset keeps ambient | Pending | Pending | Pending |
| Relaunch no zombie session | Pending | Pending | Pending |
| T3–T9 transport demos in example | Pending | Pending | Pending |

Mark Pass / Fail / N/A in each cell when QA completes. Fail blocks ROADMAP “done.”

After example `npx expo prebuild`, run `yarn assert:prebuild` from the repo root to verify injected modes / FGS / service / `stopWithTask`. For Android-only prebuild (as in CI), use `yarn assert:prebuild -- --platform android`.
