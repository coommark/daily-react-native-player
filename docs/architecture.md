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
| 6 | Silence = first-class queue items; native-owned sources (`silence:<ms>` wire; Android `SilenceMediaSource` + `mediaId=track.id`; iOS cached PCM WAV). Bind helper never decodes `silence:` as a media URI. See [`silence-tracks.md`](./silence-tracks.md). |
| 7 | Ambient consumer-opt-in + lazy; required for Bible-ready 0.1.0 |
| 8 | P0 background / metadata gates v0.1 device QA |
| 9 | Progressive WAV/mp3/m4a (+ platform codecs) from T3; **HLS VOD** with seek-after-ready (T9); no DASH/SS/live DVR in v0.1 |
| 10 | Support policy: **tested** Expo 57.x / RN 0.86.2 / React 19.2.3 / Node ≥22.13; **floor** `expo >=57` / `react-native >=0.86` / New Arch only; newer SDKs best-effort; Expo 53–56 unsupported. `expo` is a **required** peer (not optional) because Expo Modules Core is mandatory. |
| 11 | Playback rate limits are app policy; player supports general `setRate` |
| 12 | Native queue is the sole source of truth (JS is a thin facade) |
| 13 | Stable `Track.id` / Exo `mediaId` / iOS association key |
| 14 | Serialized mutation lane + `queueEpoch` (stale callbacks discarded) |
| 15 | MediaSession / Now Playing expose **single current item** (remotes stay emit-only) |
| 16 | Prepare window (active ± 1–2) for chapter-scale queues |
| 17 | Event observer policy: Remote* + lifecycle Playback* always-on; progress via `OnStartObserving` / `OnStopObserving` |
| 18 | Mix mode `androidAudioMixMode` `default` \| `duckOthers`: speech owns focus; ambient never requests focus; iOS `.duckOthers` when ambient has started (T10) |

### ADR-12 — Native queue sole truth (T6)

Queue order, active index, and per-track metadata live only in `SpeechEngine`. JS validates URLs/types and forwards mutations. `forcedNowPlaying` is a display overlay, not a queue row.

### ADR-13 — Stable track identity (T6)

Assign `id` on enqueue if omitted. Android `MediaItem.mediaId` and iOS side-table use the same id. Events carry track identity; indices are snapshots.

### ADR-14 — Mutation lane + queueEpoch (T6)

All `add` / `remove` / `skip*` / `reset` / metadata-for-track run on the serial main/player path. Bump `queueEpoch` on structural change and `reset`; discard stale artwork/timer/end callbacks.

### ADR-15 — MediaSession single-item honesty (T6)

Expose at most the current playable item to MediaSession / Now Playing. ForwardingPlayer / MPRemote next-prev stay emit-only so Controllers cannot native-skip behind JS policy.

### ADR-16 — Prepare window (T6)

Full metadata list natively; materialize/prepare only active ± 1–2 items. Batch add is O(n) list append without n decoder warmups.

### ADR-17 — Event observer policy (T6)

| Class | Events | Policy |
| --- | --- | --- |
| Remotes | Remote* | Always emit; never tear down on last UI detach |
| Lifecycle | State, ActiveTrackChanged, QueueEnded, Error, PlayWhenReadyChanged | Always emit while engine alive |
| Hot path | PlaybackProgressUpdated | Start/stop timer via `OnStartObserving` / `OnStopObserving` for that wire name; also respect `progressUpdateEventInterval === 0` |

## Layers

- **JS:** imperative Player API (named exports), silence helpers (`createSilenceTrack` / `isSilenceTrack`), optional ambient facade (T10)
- **Config plugin (T2):** plugin-owned iOS `UIBackgroundModes: audio` + Android FGS permissions + `PlaybackService` declaration in the *app* manifest (`createRunOncePlugin`, `enableBackgroundPlayback` escape hatch). Library AAR owns the Kotlin `PlaybackService` class and pinned Media3 deps; library manifest stays free of FGS/service.
- **Native (T3 + T4 + T6):** process-scoped `SpeechEngine` owns the speech player (Android ExoPlayer Media3 **1.8.0**, iOS AVPlayer). Queue metadata list is authoritative; player holds the active item (prepare window). Mutations are serialized (Android player looper / main; iOS main via AsyncFunction). `reset()` clears the full queue + now-playing display only. Dual players are forbidden. T4 attaches a unique-id `MediaSession` (Android) and `MPNowPlayingInfoCenter` / `MPRemoteCommandCenter` (iOS) to that same player.
- **Audio policy (T3):** Android `USAGE_MEDIA` + `CONTENT_TYPE_SPEECH`; iOS `AVAudioSession` category `.playback`, mode `.spokenAudio`, Bluetooth/AirPlay options. Mix modes = T10. Android audio focus owned by `SpeechEngine` (emit `remote-duck`); JS remote events = T5.

## T4 ownership (binding)

| Object | Owner | Rules |
| --- | --- | --- |
| ExoPlayer / AVPlayer | `SpeechEngine` only | `PlaybackService` never constructs a player |
| `MediaSession` | `SessionHolder`, created only when `SpeechEngine.getPlayer()` is non-null | Unique id = UUID at first create in this process; **never reuse** after release |
| FGS + media notification | `PlaybackService` via Media3 notification pipeline | `onGetSession` returns live session or `null` if not ready (fail-closed) |
| Now Playing / remotes (iOS) | `NowPlayingController` beside `SpeechEngine.shared` | Tear down remote targets on `releaseEngine` only |

### Media3 sample delta

Google’s Media3 background guide co-locates `Player` + `MediaSession` inside `MediaSessionService.onCreate`. We **intentionally** keep the player in `SpeechEngine` so the Expo module JS API has a stable process-scoped owner and ambient (T10) can share the same process without a second focus-owning session.

Compliance:

- Session is built with `SpeechEngine.getPlayer()` (no second / fake bootstrap player — ADR 4)
- Session is registered on `PlaybackService` so Media3 still promotes FGS via `onUpdateNotification` when playing
- Service stop policies release **session** per the kill matrix; player release only when destroy policy allows

### Kill / destroy matrix

| Event | ContinuePlayback | PausePlayback | StopAndRemoveNotification |
| --- | --- | --- | --- |
| `onTaskRemoved` | Keep player + session + notification | Pause; grace demote | Stop; remove notification; stop service when idle |
| Module `OnDestroy` while FGS playing | Do **not** release | Pause path | Full release |
| `reset()` | Clear source + NP display; keep session / remotes / options | same | same |
| Process death | OS wins; new session id on next cold start | — | — |

When idle / not FGS-active, `OnDestroy` releases as before (T3 behavior).

### Remote policy (T4 vs T5)

- **T5 (current):** Play / Pause / Stop / Next / Previous remotes are **emit-only** → JS via `registerPlaybackService` + `Event.Remote*`. Seek scrubber stays native. Fail-closed if no JS service (no native surprise play).
- Android headless task key: **`DailyReactNativePlayer`** (`HEADLESS_TASK_NAME`). Embedded in `PlaybackService`; task finish must **not** stop the FGS.
- Do **not** tear down remotes when the last JS UI listener detaches (`OnStopObserving`).
- Internal JS `play()` / `pause()` use the raw engine — never re-emit as Remote*.

### Ambient invariant (T10)

Speech owns the sole MediaSession / Now Playing. Ambient never requests focus and never owns lock-screen metadata. Lazy `AmbientEngine` (second ExoPlayer / AVPlayer) created only on first ambient API. See ADR-18 and [`dual-audio.md`](./dual-audio.md).

Detail expands as tickets land. See also `docs/background-playback.md` and `docs/dual-audio.md`.
