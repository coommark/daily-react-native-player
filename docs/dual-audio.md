# Dual audio / ambient (consumer opt-in)

Ambient background music under speech is **optional for consumers** (lazy init — speech-only apps never create a second player) and **required for [Daily Bible - Offline & Audio](https://dailybiblenow.com)’s 0.1.0 migration**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Contract

- Second native player inside the same Expo module audio owner (`AmbientEngine`)
- Ambient **never** requests Android audio focus
- Speech remains the focus owner; mix mode `default` | `duckOthers` when ambient has started
- Native volume, fade, loop-one / loop-all
- Ambient must **not** own Now Playing metadata (speech owns lock-screen)
- Keep iOS session active while ambient plays during speech queue rebuilds
- Speech `reset()` does **not** stop ambient
- `ambientStop` stops + seeks to start + cancels fade; keeps the engine instance (warm restart)

## API

| Method | Behavior |
| --- | --- |
| `ambientSetPlaylist(urls, loopAll?)` | Replace playlist. `loopAll: false` (default) = loop-one; `true` = play through then wrap. Empty clears. URLs may be `silence:<ms>` from `createSilenceTrack`. |
| `ambientPlay` / `ambientPause` / `ambientStop` | Transport. Stop resets position to start of playlist. |
| `ambientSetVolume(0…1)` | Immediate; cancels in-flight fade |
| `ambientFade(target, durationMs)` | Fire-and-forget ramp; cancelled by new fade / setVolume / pause / stop |

Requires `setupPlayer()` first (`not_initialized` otherwise).

## Typical call order (Bible)

```ts
await setupPlayer({ androidAudioMixMode: 'duckOthers' });
await ambientSetPlaylist([bedUrl], true);
await ambientSetVolume(0);
await ambientPlay();
await ambientFade(0.35, 1500);
// speech queue / play as usual — remotes still control speech only
```

Silence gaps between ambient tracks reuse core [`createSilenceTrack`](./silence-tracks.md) when loop-all is enabled (insert `silence:` urls in the playlist).

## Lifecycle

| Event | Ambient |
| --- | --- |
| First ambient API after setup | Create engine once |
| `ambientStop` | Stop, pos→0, cancel fade, keep instance |
| Speech `reset` | **Keep playing** |
| Full speech engine release | Tear down ambient |
| Speech-only apps | Second player **never** constructed |

## Mix mode (ADR-18)

Option `androidAudioMixMode: 'default' | 'duckOthers'` (default `default`). Name keeps Bible parity; behavior is cross-platform: speech keeps focus; ambient never requests it; host owns speech↔ambient balance via volume/fade.
