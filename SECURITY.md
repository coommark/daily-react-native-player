# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public GitHub issue for exploitable flaws.

1. Prefer [GitHub private vulnerability advisories](https://github.com/coommark/daily-react-native-player/security/advisories/new) on this repository, or
2. Email the maintainer listed in `package.json` (`author`) with a description, impact, and reproduction steps.

We aim to acknowledge reports within **7 days** and to ship a fix or mitigation for confirmed issues as soon as practical. There is no bug bounty program at this time.

## Scope

This package is a media player (speech queue + optional ambient). Reports related to:

- Privilege escalation via the config plugin / FGS declaration
- Session / notification spoofing that affects other apps
- Unsafe URL handling that leads to unexpected native code execution

…are in scope. Issues that only affect app-level product policy (e.g. RemoteNext mapping) belong in normal issues.
