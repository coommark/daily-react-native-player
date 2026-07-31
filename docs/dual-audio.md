# Dual audio / ambient (consumer opt-in)

Ambient background music under speech is **optional for consumers** (lazy init — speech-only apps never create a second player) and **required for [Daily Bible - Offline & Audio](https://dailybiblenow.com)’s 0.1.0 migration**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Contract (planned)

- Second native player inside the same audio owner / service
- Ambient **never** requests Android audio focus
- Speech remains the focus owner; mix mode `default` | `duckOthers` when ambient is on
- Native volume, fade, loop-one / loop-all
- Ambient must **not** own Now Playing metadata (speech owns lock-screen)
- Keep iOS session active while ambient plays during speech queue rebuilds

## Typical call order (Bible)

1. Ensure player ready / mix mode synced
2. `ambientSetPlaylist(urls, loopAll)`
3. `ambientSetVolume(0)` → `ambientPlay()` → `ambientFade(target, ms)`

Silence gaps between ambient tracks use core silence helpers when loop-all is enabled.
