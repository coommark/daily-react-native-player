# Contributing

## Basics

1. Read [`.cursorrules`](../.cursorrules) and [`AGENTS.md`](../AGENTS.md)
2. Pick the next ticket from [`ROADMAP.md`](../ROADMAP.md)
3. Keep diffs minimal; leave tests green
4. Update docs + ROADMAP checkboxes in the same PR / change set

This package is developed **primarily for [Daily Bible - Offline & Audio](https://dailybiblenow.com)**
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).
Prefer Bible acceptance work over speculative features until 0.1.0 is Bible-ready.

## Setup

```bash
yarn
yarn build
yarn test
yarn lint
```

Example app:

```bash
cd example
yarn start
```

Import the package as consumers will:

```ts
import { setupPlayer, add, play } from 'daily-react-native-player';
```

## Skills

Install Expo’s `expo-module` skill for agents editing native modules:

```bash
npx skills@latest add expo/skills --skill 'expo-module'
```

## Test matrix

| Layer | What it covers |
| --- | --- |
| **Jest** (`yarn test`) | Public exports, validation, option merge, event wire-name parity, web stubs |
| **Device / emulator** | Real queue auto-advance, MediaSession remotes→JS→skip*, now-playing refresh, progress ticks |
| **Android `assembleRelease`** | After `consumer-rules.pro` / Media3 changes |

Emulator audio is non-authoritative for P0 lock-screen QA; prefer a physical device for remotes.

## Naming

Do not name commercial predecessor libraries in code, docs, issues, or commits.

## Private reference

Optional local study trees under `.reference/` are gitignored. Never commit them. Never copy their source into this repo.
