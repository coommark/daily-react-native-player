# API

Public surface for `daily-react-native-player`. Keep in sync with exports and [`bible-acceptance.md`](./bible-acceptance.md).

Primary host: [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

**Peers:** Expo SDK 57+ (Expo Modules Core required), React Native 0.86+, New Architecture only. Web transport is unsupported. Hosts on Expo &lt;57 must upgrade the app before adopting this package.

## Implemented (T3–T11 hardening)

```ts
import {
  setupPlayer,
  updateOptions,
  add,
  remove,
  getQueue,
  getActiveTrack,
  getActiveTrackIndex,
  skip,
  skipToNext,
  skipToPrevious,
  updateNowPlayingMetadata,
  updateMetadataForTrack,
  play,
  pause,
  seekTo,
  getProgress,
  getPlaybackState,
  getPlayWhenReady,
  setPlayWhenReady,
  reset,
  getPlayerOptions,
  createSilenceTrack,
  isSilenceTrack,
  registerPlaybackService,
  addEventListener,
  Event,
  HEADLESS_TASK_NAME,
  Capability,
  AppKilledPlaybackBehavior,
  State,
  PlayerErrorCode,
  PlayerException,
} from 'daily-react-native-player';
```

### Silence (T7)

| Export | Behavior |
| --- | --- |
| `createSilenceTrack({ durationMs, id? })` | Sync helper → canonical `{ type: 'silence', url: 'silence:<ms>', duration }` |
| `isSilenceTrack(track)` | `track?.type === 'silence'` — use for host rate / skip policy |
| `CreateSilenceTrackOptions` | Type for the helper options |
| `Track.type: 'silence'` | First-class queue item; `duration` in seconds |
| `durationMs` bounds | Integer in `(0, 300000]` |

Uses (verse gaps, why not timers, native ownership): [`silence-tracks.md`](./silence-tracks.md). Queue insert example: [`queue.md`](./queue.md).

### Bootstrap (required for remotes)

Call **once** at the app entry file — **before** `registerRootComponent` / `AppRegistry.registerComponent`. Do **not** register inside `useEffect`.

```ts
// index.ts
import { registerPlaybackService } from 'daily-react-native-player';
import { registerRootComponent } from 'expo';
import App from './App';
import { playbackService } from './playbackService';

registerPlaybackService(() => playbackService);
registerRootComponent(App);
```

| Constant / method | Behavior |
| --- | --- |
| `HEADLESS_TASK_NAME` | `'DailyReactNativePlayer'` — Android headless task key (must not collide) |
| `registerPlaybackService(factory)` | Android: `AppRegistry.registerHeadlessTask`; iOS: `setImmediate` runs handler; web: no-op. Idempotent. |
| `addEventListener(event, listener)` | Subscribe to Remote* and Playback* events; returns `{ remove }`. Prefer remotes from the playback service. |

### Lifecycle / transport

| Method | Behavior |
| --- | --- |
| `setupPlayer(options?)` | Idempotent. Creates the native speech engine, applies options, attaches MediaSession / Now Playing when background playback is available. |
| `updateOptions(partial)` | Merges into **persisted** options; re-applies remotes / kill policy / metadata flags / progress interval. Survives `reset()`. |
| `play()` / `pause()` | Transport; map to play-when-ready. `play` rejects `no_source`. Internal path — does **not** emit Remote*. |
| `seekTo(seconds)` | Absolute position in **seconds** (≥ 0). |
| `setRate(rate)` | Playback rate in **`[0.25, 4.0]`** (engine safety). Hosts clamp product UX (e.g. 0.75–1.0). Pitch-preserving. While a silence track is active, native applies effective **1.0** without clearing the desired rate; leaving silence restores it. `reset()` restores desired rate to **1.0**. |
| `getProgress()` | `{ position, duration, buffered }` in seconds. |
| `getPlaybackState()` | `none` \| `loading` \| `ready` \| `playing` \| `paused` \| `ended` \| `error` |
| `getPlayWhenReady()` / `setPlayWhenReady(bool)` | Play intent. |
| `reset()` | Clears **entire queue** + now-playing display; retains engine, session, remotes, and options. |

## Queue (T6)

Native owns the queue — this is the **speech playlist** hosts use for chapters of verses, lessons, and progressive TTS append. Product guide: [`queue.md`](./queue.md).

| Method | Behavior |
| --- | --- |
| `add(track \| track[], insertBeforeIndex?)` | **Append** (or insert before index). Returns `Promise<number[]>` of inserted indices. Empty queue → load/prepare first item. Validates all tracks before any mutation. |
| `remove(indexes)` | Remove by index (number or array). See remove matrix in architecture. |
| `getQueue()` | Snapshot of tracks (each includes assigned `id`). |
| `getActiveTrack()` / `getActiveTrackIndex()` | `undefined` when empty. |
| `skip(index)` | Jump to track at position 0; preserves play-when-ready. |
| `skipToNext` / `skipToPrevious` | Empty → `no_source`. At ends → no-op success. |

**Migration from T3 single-source `add`:** `add` no longer replaces the current item. To replace: `await reset(); await add(track);` (or remove all then add). Appending while playing does **not** clear a forced now-playing overlay; clearing forced metadata only happens when adding to an **empty** queue (or `reset`).

```ts
// Playlist in one shot
await add([
  { url: a, title: '1' },
  { url: b, title: '2' },
]);
// Keep generating / appending
await add({ url: c, title: '3' });
```

### Metadata

| Method | Behavior |
| --- | --- |
| `updateNowPlayingMetadata(partial)` | **Forced** lock-screen / notification overlay (wins over track fields). |
| `updateMetadataForTrack(index, partial)` | Any in-range queue index. |

Precedence: forced overlay → track fields when `autoUpdateMetadata` → file tags.

### Options defaults

| Option | Default |
| --- | --- |
| `capabilities` | Play, Pause, Stop, SkipToNext, SkipToPrevious |
| `autoUpdateMetadata` | `true` |
| `appKilledPlaybackBehavior` | `ContinuePlayback` (`continue-playback`) |
| `stopForegroundGracePeriod` | `5` (seconds) |
| `autoHandleInterruptions` | `false` (emit `remote-duck` only; no auto pause/resume) |
| `progressUpdateEventInterval` | `1` (seconds); `0` disables progress events |
| `androidAudioMixMode` | `'default'` \| `'duckOthers'` (T10; iOS duck when ambient started) |

### Remote policy (T5)

**Emit-only (fail-closed):** lock screen, media notification, Control Center, and **Bluetooth / headset** remotes emit JS events. They do **not** call native transport. Your playback service must call `play()` / `pause()` / `skip*`.

Product overview of all system surfaces: [`background-playback.md`](./background-playback.md).

| Event (`Event.*`) | Wire name | Typical handler |
| --- | --- | --- |
| `RemotePlay` | `remote-play` | `play()` |
| `RemotePause` | `remote-pause` | `pause()` |
| `RemotePlayPause` | `remote-play-pause` | toggle via `getPlayWhenReady` |
| `RemoteStop` | `remote-stop` | usually `pause()` |
| `RemoteNext` | `remote-next` | host policy → often `skipToNext()` |
| `RemotePrevious` | `remote-previous` | host policy → often `skipToPrevious()` |
| `RemoteDuck` | `remote-duck` | `{ paused, permanent }` |

**Seek scrubber** stays **native** (no `RemoteSeek` in v0.1).

### Playback events (T6)

Drive playlist UI without polling. Always emitted while the engine is alive (except progress — see below). Product overview: [`queue.md`](./queue.md).

| Event | Wire | Payload |
| --- | --- | --- |
| `PlaybackActiveTrackChanged` | `playback-active-track-changed` | `{ index, track, lastIndex, lastTrack }` (nulls when empty) |
| `PlaybackState` | `playback-state` | `{ state }` |
| `PlaybackQueueEnded` | `playback-queue-ended` | `{ track, index, position }` |
| `PlaybackError` | `playback-error` | `{ code, message, trackId?, index? }` |
| `PlaybackProgressUpdated` | `playback-progress-updated` | `{ position, duration, buffered }` |
| `PlaybackPlayWhenReadyChanged` | `playback-play-when-ready-changed` | `{ playWhenReady }` |

**Progress:** timer runs only when `progressUpdateEventInterval > 0`, state is `playing`, and at least one JS listener is subscribed (`OnStartObserving` / `OnStopObserving`).

**Who listens where:** playback service → Remote* (+ optional Playback*); UI → Playback* for chrome. Remotes still fail-closed without `registerPlaybackService`.

### Track

```ts
type Track = {
  id?: string; // assigned on add if omitted; always present in getQueue / events
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  type?: 'default' | 'hls' | 'silence'; // silence = native gap; hls = VOD streaming
  duration?: number; // seconds; authoritative for silence
};
```

### URI policy

| Scheme | Rule |
| --- | --- |
| `https://` | Preferred for remote (incl. artwork) |
| `http://` | Allowed; subject to ATS / cleartext config |
| `file://` | App-sandbox paths |
| `content://` | Android only |
| Bundled assets | Resolve with `Image.resolveAssetSource(require(...))` before `add` |
| Relative / other schemes | Rejected |

### Errors

Failures throw `PlayerException` with stable `code`:

`not_initialized` · `no_source` · `invalid_argument` · `unsupported_url` · `unsupported_type` · `load_failed` · `playback_failed` · `platform_unsupported` · `setup_timeout`

Call `setupPlayer()` before transport (`reset` is the exception). New Architecture required. Web: transport APIs throw `platform_unsupported`; `addEventListener` / `registerPlaybackService` are no-ops.

Runtime SLAs (timeouts, remotes fail-closed, stop/reset order, FGS): [`contracts.md`](./contracts.md).

### Options highlights

| Option | Notes |
| --- | --- |
| `debug` | Optional verbose logs (default `false`) |
| `androidAudioMixMode` | `default` \| `duckOthers` |
| `appKilledPlaybackBehavior` | Continue / Pause / StopRemove |
| `progressUpdateEventInterval` | Seconds; `0` disables |

**Recommended Stop policy:** `pause()` then `reset()` (see example `playbackService.ts`). Native `reset` also clears play-intent first.

## Deferred (Phase 2)

Buffer knobs — engine defaults in 0.1.0. Physical device P0 QA matrices: [`background-playback.md`](./background-playback.md).

### Ambient

See [`dual-audio.md`](./dual-audio.md): `ambientSetPlaylist`, `ambientPlay` / `pause` / `stop`, `ambientSetVolume`, `ambientFade`, option `androidAudioMixMode`.
