# API

Public surface for `daily-react-native-player`. Keep in sync with exports and [`bible-acceptance.md`](./bible-acceptance.md).

Primary host: [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

**Peers:** Expo SDK 53+ (Expo Modules Core required), React Native 0.79+, New Architecture only. Web transport is unsupported.

## Implemented (T3)

```ts
import {
  setupPlayer,
  add,
  play,
  pause,
  seekTo,
  getProgress,
  getPlaybackState,
  getPlayWhenReady,
  setPlayWhenReady,
  reset,
  State,
  PlayerErrorCode,
  PlayerException,
} from 'daily-react-native-player';
```

| Method | Behavior |
| --- | --- |
| `setupPlayer(options?)` | Idempotent. Creates the native speech engine. `options` reserved for later `updateOptions`. |
| `add(track \| track[])` | **Single active source (T3):** uses the first track only; replaces the current item. Multi-track queue = T6. |
| `play()` / `pause()` | Transport; map to play-when-ready. `play` rejects `no_source`. |
| `seekTo(seconds)` | Absolute position in **seconds** (≥ 0). Clamped when duration known; pending seek applied when ready. |
| `getProgress()` | `{ position, duration, buffered }` in seconds; unknowns are `0`. |
| `getPlaybackState()` | `none` \| `loading` \| `ready` \| `playing` \| `paused` \| `ended` \| `error` |
| `getPlayWhenReady()` / `setPlayWhenReady(bool)` | Play intent. |
| `reset()` | Clears source; retains engine. Safe before setup. |

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
| `https://` | Preferred for remote |
| `http://` | Allowed; subject to ATS / cleartext config |
| `file://` | App-sandbox paths |
| `content://` | Android only |
| Bundled assets | Resolve with `Image.resolveAssetSource(require(...))` before `add` |
| Relative / other schemes | Rejected |

### Errors

Failures throw `PlayerException` with stable `code`:

`not_initialized` · `no_source` · `invalid_argument` · `unsupported_url` · `unsupported_type` · `load_failed` · `playback_failed` · `platform_unsupported`

Call `setupPlayer()` before transport (`reset` is the exception).

## Not yet implemented

Lifecycle options / remotes / queue / silence / ambient / HLS — see [`bible-acceptance.md`](./bible-acceptance.md) and [`ROADMAP.md`](../ROADMAP.md).
