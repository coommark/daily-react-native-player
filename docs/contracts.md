# Runtime contracts (host SLAs)

Binding behavioral guarantees for `daily-react-native-player` hosts. Architecture decisions live in [`architecture.md`](./architecture.md); this file is the **timeout / idempotency / fail-closed** surface.

## Thread model

- All speech queue / transport / session mutations run on the Android player/main looper and iOS main queue.
- JS must not assume parallel native mutation; overlapping calls are serialized natively and (for setup) coalesced in JS.
- Ambient mutations use the same main-lane pattern and never request audio focus.

## `setupPlayer`

| Guarantee | Detail |
| --- | --- |
| Idempotent | Already-initialized native engine returns success (no error). |
| Coalesce | Concurrent callers share one in-flight promise; options from each caller are merged into persisted options before/during that call. |
| Timeout | **10 seconds** → throws `setup_timeout` (`PlayerException`). |
| Retry | After failure (including timeout), in-flight state clears so a later call may retry. |
| New Architecture | Required; throws `platform_unsupported` if Bridgeless is explicitly false. |

## `registerPlaybackService`

| Guarantee | Detail |
| --- | --- |
| Idempotent | Second factory is ignored (`__DEV__` warn). |
| Fail-closed remotes | Without registration, lock-screen / headset remotes **do not** execute native transport (emit path has no JS policy). |
| Task key | Android headless task name: `DailyReactNativePlayer`. Task finish must **not** stop the FGS. |

## Remotes

- Play / Pause / Stop / Next / Previous are **emit-only** → JS (`Event.Remote*`).
- UI / JS `play()` / `pause()` never re-emit as Remote*.
- Seek scrubber stays native.

## Stop / reset

**Recommended host order** when ending a speech session (e.g. RemoteStop):

1. `pause()` or `setPlayWhenReady(false)` — clear play-intent
2. `reset()` — clear queue + now-playing display

Native `reset()` also clears play-intent and bumps `queueEpoch` **first**, then clears the queue, so late load/end callbacks cannot revive audio. The example app uses pause → reset as a **recommended** demo; hosts may keep pause-only Stop if product policy requires it.

| `reset()` keeps | `reset()` clears |
| --- | --- |
| MediaSession / remotes / persisted options | Queue, active source, now-playing display |
| Ambient engine (if running) | Speech play-when-ready |

Re-`updateOptions` after `reset` is supported; options also persist across reset automatically.

## Kill matrix (Android)

| Policy | `onTaskRemoved` |
| --- | --- |
| `ContinuePlayback` | Keep player + session + notification |
| `PausePlayback` | Pause; demote FGS after `stopForegroundGracePeriod` (default **5s**) |
| `StopPlaybackAndRemoveNotification` | Stop; remove notification; stop service when idle |

Process death: OS wins; next cold start gets a **new** MediaSession UUID (never reuse after release).

## FGS / notification (Android)

- `startForegroundService` only after (or with) MediaSession created and `addSession` on `PlaybackService`.
- `onUpdateNotification` promotes with synchronous `startForeground` within the OS deadline.
- Never leave a started FGS without a notification path (fallback minimal ongoing notification if Media3 promotion is late).
- No FGS from `BOOT_COMPLETED`.

## Ambient

- Lazy: first ambient API creates the second player; speech-only apps never pay the cost.
- Never requests audio focus; never owns lock-screen / Now Playing metadata.
- Speech `reset()` does **not** release ambient.

## Timeouts (native)

Android main-thread hops used for setup / session attach / engine mutations await at most **10 seconds**, then fail closed with a coded error (no unbounded latch hang → ANR).

## Errors: throw vs event

| Path | Codes (stable strings) |
| --- | --- |
| **Thrown** | `not_initialized`, `invalid_argument`, `unsupported_url`, `unsupported_type`, `platform_unsupported`, `setup_timeout`, `no_source`, … |
| **`PlaybackError` event** | `load_failed`, `playback_failed` (and related load/play failures) |

Wire event name remains `playback-error`. Optional `debug: true` in player options enables verbose native/JS logs (off by default; no PII).

## Privacy (iOS)

Silence WAV cache uses `FileManager` caches directory writes only. No App Store **required-reason** APIs (file timestamps, UserDefaults boot APIs, etc.) are used; `PrivacyInfo.xcprivacy` ships with an empty accessed-API list by design.

## Related

- [`background-playback.md`](./background-playback.md) — P0 device QA matrices
- [`api.md`](./api.md) — public API
- [`bible-acceptance.md`](./bible-acceptance.md) — Daily Bible surface
