# Roadmap

Living ticket list for `daily-react-native-player`. Update checkboxes when a ticket ships; update docs in the same change.

**Primary product:** [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Tickets prioritize what that app needs before optional community extras.

**Milestones**

- **Core MVP:** P0 + P1 green in the example app
- **0.1.0 / Bible-ready:** Core MVP **plus** T10 ambient (Daily Bible uses ambient today)

Acceptance surface: [`docs/bible-acceptance.md`](./docs/bible-acceptance.md).

**Peer floor:** Expo SDK **57+** / React Native **0.86+** (New Architecture only). See ADR 10 in [`docs/architecture.md`](./docs/architecture.md).

## Tickets

| ID | Pri | Ticket | Status |
| --- | --- | --- | --- |
| T0 | — | Foundation: git, cursorrules, docs, LICENSE, skills, `.reference` | done |
| T1 | — | Scaffold Expo module + example (New Arch) + CI + contract-test skeleton | done |
| T2 | P0 | Config plugin: iOS audio BG + Android FGS / MediaSessionService | done |
| T3 | — | Progressive formats (WAV, mp3/m4a, platform codecs) + play / pause / seek | done |
| T4 | P0 | MediaSession + Now Playing + remotes + metadata + ContinuePlayback | code complete — **device QA required** before done |
| T5 | P0 | `registerPlaybackService` + remote → JS bridge | done — **device QA** for remotes→JS recommended with T4 matrix |
| T6 | P1 | Queue API + events (Bible matrix) | pending |
| T7 | P1 | Native silence tracks | pending |
| T8 | P1 | Progressive queue mutation + `setRate` + reset → reapply options | pending |
| T9 | P1 | HLS + seek-after-ready | pending |
| T10 | P2 | Ambient (lazy, fade, loop, mix modes) — required for Bible-ready | pending |
| T11 | — | Hardening + device P0 QA | pending |
| T12 | — | Docs polish + publishable 0.1.0 | pending |

## Non-goals (v0.1)

Old architecture; MediaLibrary / Android Auto browse; DASH / SmoothStreaming; web player; Cast; TTS inside this package; forcing ambient for all consumers.
