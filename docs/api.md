# API

Public surface for `daily-react-native-player`. Keep in sync with exports and [`bible-acceptance.md`](./bible-acceptance.md).

Primary host: [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

**Peers:** Expo SDK 57+ (Expo Modules Core required), React Native 0.86+, New Architecture only. Web transport is unsupported. Hosts on Expo &lt;57 must upgrade the app before adopting this package.

## Implemented (T3 + T4 + T5)

```ts
import {
  setupPlayer,
  updateOptions,
  add,
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
| `addEventListener(event, listener)` | Subscribe to Remote* events; returns `{ remove }`. Prefer from the playback service. |

This is **not** `expo-background-task` / TaskManager — those are for periodic fetch, not lock-screen remotes.

| Method | Behavior |
| --- | --- |
| `setupPlayer(options?)` | Idempotent. Creates the native speech engine, applies options, attaches MediaSession / Now Playing when background playback is available. |
| `updateOptions(partial)` | Merges into **persisted** options; re-applies remotes / kill policy / metadata flags. Survives `reset()`. |
| `add(track \| track[])` | **Single active source:** first track only. Forwards `{ url, title?, artist?, album?, artwork? }` when `autoUpdateMetadata` is true. |
| `updateNowPlayingMetadata(partial)` | **Forced** lock-screen / notification metadata override (wins over track fields). |
| `updateMetadataForTrack(index, partial)` | Index `0` only until T6. |
| `play()` / `pause()` | Transport; map to play-when-ready. `play` rejects `no_source`. Internal path — does **not** emit Remote*. |
| `seekTo(seconds)` | Absolute position in **seconds** (≥ 0). |
| `getProgress()` | `{ position, duration, buffered }` in seconds. |
| `getPlaybackState()` | `none` \| `loading` \| `ready` \| `playing` \| `paused` \| `ended` \| `error` |
| `getPlayWhenReady()` / `setPlayWhenReady(bool)` | Play intent. |
| `reset()` | Clears source + now-playing display; retains engine, session, remotes, and options. |

### Options defaults

| Option | Default |
| --- | --- |
| `capabilities` | Play, Pause, Stop, SkipToNext, SkipToPrevious |
| `autoUpdateMetadata` | `true` |
| `appKilledPlaybackBehavior` | `ContinuePlayback` (`continue-playback`) |
| `stopForegroundGracePeriod` | `5` (seconds) |
| `autoHandleInterruptions` | `false` (emit `remote-duck` only; no auto pause/resume) |

### Remote policy (T5)

**Emit-only (fail-closed):** lock-screen / notification / headset remotes emit JS events. They do **not** call native transport. Your playback service must call `play()` / `pause()` (and later skip APIs).

| Event (`Event.*`) | Wire name | Typical handler |
| --- | --- | --- |
| `RemotePlay` | `remote-play` | `play()` |
| `RemotePause` | `remote-pause` | `pause()` |
| `RemotePlayPause` | `remote-play-pause` | toggle via `getPlayWhenReady` (iOS toggle) |
| `RemoteStop` | `remote-stop` | usually `pause()` (does not clear source) |
| `RemoteNext` | `remote-next` | host policy (verse/chapter); no native skip until T6 |
| `RemotePrevious` | `remote-previous` | host policy |
| `RemoteDuck` | `remote-duck` | `{ paused: boolean, permanent: boolean }` |

**Seek scrubber** stays **native** (no `RemoteSeek` in v0.1).

If you forget `registerPlaybackService`, remotes emit into empty JS (no surprise native play). In `__DEV__`, native may log missing listeners.

### Metadata precedence

1. `updateNowPlayingMetadata` (forced)
2. Else track fields from `add` / `updateMetadataForTrack` when `autoUpdateMetadata`
3. Artwork load failures never fail playback

### Track

```ts
type Track = {
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  type?: 'default' | 'hls'; // HLS rejected until T9
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

Call `setupPlayer()` before transport (`reset` is the exception). New Architecture required.

## Not yet implemented

Queue (T6), silence (T7), rate / mutation (T8), HLS (T9), ambient (T10) — see [`bible-acceptance.md`](./bible-acceptance.md) and [`ROADMAP.md`](../ROADMAP.md).
