# Roadmap

Living ticket list for `daily-react-native-player`. Update checkboxes when a ticket ships; update docs in the same change.

**Primary product:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Tickets prioritize what that app needs before optional community extras.

**Milestones**

- **Core MVP:** P0 + P1 green in the example app — **done**
- **0.1.0:** Core MVP **plus** T10 ambient **plus** publishable packaging — **done** (npm publish is a separate release step)

Contributor note: optional physical P0 device matrices live in [`docs/background-playback.md`](./docs/background-playback.md).

P0 background / lock-screen / Bluetooth remotes: [`docs/background-playback.md`](./docs/background-playback.md).  
Playlist / queue product guide: [`docs/queue.md`](./docs/queue.md).  
Acceptance surface: [`docs/bible-acceptance.md`](./docs/bible-acceptance.md).  
Runtime SLAs: [`docs/contracts.md`](./docs/contracts.md).

**Peer floor:** Expo SDK **57+** / React Native **0.86+** (New Architecture only). See ADR 10 in [`docs/architecture.md`](./docs/architecture.md).

## Tickets

| ID | Pri | Ticket | Status |
| --- | --- | --- | --- |
| T0 | — | Foundation: git, cursorrules, docs, LICENSE, skills, `.reference` | done |
| T1 | — | Scaffold Expo module + example (New Arch) + CI + contract-test skeleton | done |
| T2 | P0 | Config plugin: iOS audio BG + Android FGS / MediaSessionService | done |
| T3 | — | Progressive formats (WAV, mp3/m4a, platform codecs) + play / pause / seek | done |
| T4 | P0 | MediaSession + Now Playing + remotes + metadata + ContinuePlayback | **done** |
| T5 | P0 | `registerPlaybackService` + remote → JS bridge | **done** |
| T6 | P1 | Queue API + events (Bible matrix) — **speech playlist** | done |
| T7 | P1 | Native silence tracks | done |
| T8 | P1 | Progressive queue mutation + `setRate` + reset → reapply options | done |
| T9 | P1 | HLS + seek-after-ready | done |
| T10 | P2 | Ambient (lazy, fade, loop, mix modes) — required for Bible-ready | done |
| T11 | — | Hardening + device P0 QA | **done** |
| T12 | — | Docs polish + publishable packaging | **done** |

## Non-goals (v0.1)

Old architecture; MediaLibrary / Android Auto browse; DASH / SmoothStreaming; web player; Cast; TTS inside this package; forcing ambient for all consumers; buffer knobs (Phase 2).
