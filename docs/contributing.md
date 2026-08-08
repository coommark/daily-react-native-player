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

## Support matrix

| | |
| --- | --- |
| **Tested** | Expo 57.x / RN 0.86.2 / React 19.2.3 / Node ≥22.13 |
| **Floor** | `expo >=57`, `react-native >=0.86`, New Architecture **only** |
| **iOS deployment** | Podspec floor **iOS 16.4** |
| **0.x semver** | Breaking changes may ship in 0.x with a CHANGELOG entry — **pin** your dependency |

Docs live on GitHub (`docs/`); the npm tarball ships README + LICENSE + CHANGELOG only.

## Test matrix

| Layer | What it covers |
| --- | --- |
| **Jest** (`yarn test`) | Public exports, validation, option merge, setup coalesce/timeout, event wire-name parity, web stubs |
| **CI `assembleRelease`** | Example prebuild + R8 minify (Media3 / PlaybackService keep rules) |
| **Physical device** | P0 lock-screen / notification / remotes — see [`background-playback.md`](./background-playback.md) |

Emulator audio is non-authoritative for P0 lock-screen QA; prefer a physical device for remotes.

## Naming

Do not name commercial predecessor libraries in code, docs, issues, or commits.

## Security

See root [`SECURITY.md`](../SECURITY.md) for private vulnerability reporting.

## Private reference

Optional local study trees under `.reference/` are gitignored. Never commit them. Never copy their source into this repo.
