# Speech queue / playlist

Multi-track playback is a **first-class** feature of `daily-react-native-player` — not a music-app afterthought. It is the same queue Daily Bible uses for chapters of verses: append while playing, skip under your policy, and drive UI from Playback\* events.

Primary product: [Daily Bible - Offline & Audio](https://dailybiblenow.com)
([Google Play](https://play.google.com/store/apps/details?id=com.coommark.dailybible) ·
[App Store](https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448)).

## Why it matters

| Capability | Why speech apps care |
| --- | --- |
| **Multi-track playlist** | Load a chapter (or lesson) as many progressive URLs — WAV / mp3 / m4a |
| **Append while playing** | TTS / progressive generation can keep adding tracks without stopping |
| **Insert / remove** | Edit the list mid-session; remove-active advances cleanly |
| **Stable track `id`s** | Events and metadata survive index shifts |
| **Skip APIs + remotes** | Lock-screen Next/Previous emit to JS; **you** call `skipToNext` (verse logic, not dumb index) |
| **Playback\* events** | Active track, state, progress (~1s), queue ended, errors — bind UI without polling forever |
| **Chapter-scale ready** | Native prepare window keeps long queues responsive |

## Quick start

```ts
import {
  setupPlayer,
  add,
  play,
  skipToNext,
  skipToPrevious,
  getQueue,
  getActiveTrackIndex,
  addEventListener,
  Event,
} from 'daily-react-native-player';

await setupPlayer({ progressUpdateEventInterval: 1 });

// One call → a playlist
await add([
  { url: 'https://cdn.example.com/verse-1.wav', title: 'Genesis 1:1' },
  { url: 'https://cdn.example.com/verse-2.wav', title: 'Genesis 1:2' },
  { url: 'https://cdn.example.com/verse-3.wav', title: 'Genesis 1:3' },
]);

addEventListener(Event.PlaybackActiveTrackChanged, ({ index, track }) => {
  // Update “now reading” chrome
});

addEventListener(Event.PlaybackQueueEnded, () => {
  // Chapter finished
});

await play();
await skipToNext(); // or from RemoteNext in registerPlaybackService
```

Replace the whole list: `await reset(); await add(tracks);`  
(`add` **appends** — it does not replace.)

## API map

| Need | API |
| --- | --- |
| Build / extend playlist | `add(track \| track[], insertBeforeIndex?)` → inserted indices |
| Inspect | `getQueue`, `getActiveTrack`, `getActiveTrackIndex` |
| Navigate | `skip`, `skipToNext`, `skipToPrevious` |
| Edit | `remove(indexes)` |
| Clear | `reset()` (options persist) |
| UI / service | `Event.Playback*` + `Event.Remote*` via `addEventListener` |

Full contracts: [`api.md`](./api.md). Acceptance checklist: [`bible-acceptance.md`](./bible-acceptance.md).

## Remotes + your product logic

Lock screen, media notification, Control Center, and **Bluetooth / wired headset** Next/Previous are **emit-only**. They do not skip the queue by themselves. In `registerPlaybackService`:

```ts
addEventListener(Event.RemoteNext, () => {
  void skipToNext(); // or jump by verse / chapter in your app
});
addEventListener(Event.RemotePrevious, () => {
  void skipToPrevious();
});
```

That split is intentional: Bible maps remotes to **product** navigation, not raw playlist math alone. Full P0 surfaces: [`background-playback.md`](./background-playback.md).

## Example app

The `example/` app loads a multi-track queue (WAV + mp3), shows active index / title, Skip next/previous, Remove active, and wires remotes → `skip*`. Run it on a **physical** device for lock-screen QA.
