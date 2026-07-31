# Agent guide — daily-react-native-player

Read these before changing code:

1. [`.cursorrules`](./.cursorrules) — hard constraints (naming ban, P0 background, New Arch only)
2. [`ROADMAP.md`](./ROADMAP.md) — ticket order and milestones
3. [`docs/bible-acceptance.md`](./docs/bible-acceptance.md) — API surface required for Daily Bible
4. [`docs/architecture.md`](./docs/architecture.md) — ADRs

## Primary product

This player is developed **primarily for [Daily Bible - Offline & Audio](https://dailybiblenow.com)**:

- [Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible)
- [App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)

Bible-first acceptance wins over speculative community features until 0.1.0 is Bible-ready.

## Stack

- Expo Module (`create-expo-module`), New Architecture only
- Example app: Expo (see `example/`), `newArchEnabled: true`
- Package import: `import … from 'daily-react-native-player'`
- Peers: Expo SDK 53+ / React Native 0.79+ (Bible host); example may track newer Expo for module development

## Day-to-day

- Minimal diffs; keep tests green
- After each ticket: update ROADMAP checkboxes + docs
- Ambient: lazy / opt-in for consumers; required before Bible-ready 0.1.0
- Never commit `.reference/`
