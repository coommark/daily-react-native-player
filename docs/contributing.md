# Contributing

## Basics

1. Read [`AGENTS.md`](../AGENTS.md) and pick the next ticket from [`ROADMAP.md`](../ROADMAP.md)
2. Keep diffs minimal; leave tests green
3. Update docs + ROADMAP checkboxes in the same PR / change set

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

## Branching & releases

This repo uses **GitHub Flow**: `main` is the only long-lived branch. npm publishes from `main` only when `package.json` version is new on the registry.

| Branch | Role |
| --- | --- |
| **`main`** | Source of truth. Always deployable. Protected: PR required, CI must pass. |
| **`feat/*`, `fix/*`, `docs/*`, `chore/*`** | Short-lived topic branches. Always branch from latest `main`. Delete after merge. |

There is no permanent `develop` branch. Feature PRs merge to `main` without a version bump and **do not** publish.

### Day to day

1. `git checkout main && git pull && git checkout -b feat/your-change`
2. Open a PR to `main`. CI runs lint, test, build, pack-check, and Android release assemble.
3. Merge when green. **Do not** bump version in feature or fix PRs.
4. Repeat. npm stays on the last published version until a Release PR.

External contributors: fork → branch from `main` → PR back to `main`. Same rules.

### Releasing (triggers npm)

When `main` has enough changes:

1. Open a **Release PR** (title e.g. `Release 0.1.1`):
   - Bump version in lockstep: `package.json`, `ios/DailyReactNativePlayer.podspec`, `android/build.gradle` (`yarn pack:check` enforces this)
   - Update [`CHANGELOG.md`](../CHANGELOG.md)
   - Keep feature code out of the Release PR when possible
2. Merge to `main`. CI publishes if that version is not on npm, then tags `vX.Y.Z`.
3. Escape hatch: include `[skip publish]` in the merge commit message to skip the publish job.

**0.x semver:** patch = bug fixes / docs / hardening; minor = new API; `1.0.0` = stable API promise. Breaking changes may ship in 0.x with a CHANGELOG entry — hosts should pin.

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
