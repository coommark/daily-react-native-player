/**
 * Remote / policy events delivered to `registerPlaybackService` / `addEventListener`.
 * Wire names are kebab-case (public contract; must match native Expo Events).
 */

export const HEADLESS_TASK_NAME = 'DailyReactNativePlayer';

export const Event = {
  RemotePlay: 'remote-play',
  RemotePause: 'remote-pause',
  RemotePlayPause: 'remote-play-pause',
  RemoteStop: 'remote-stop',
  RemoteNext: 'remote-next',
  RemotePrevious: 'remote-previous',
  RemoteDuck: 'remote-duck',
} as const;

export type EventType = (typeof Event)[keyof typeof Event];

/** Payload for {@link Event.RemoteDuck}. */
export type RemoteDuckEvent = {
  paused: boolean;
  permanent: boolean;
};

/** All remote event wire names (parity with native `Events(...)`). */
export const REMOTE_EVENT_NAMES: readonly EventType[] = [
  Event.RemotePlay,
  Event.RemotePause,
  Event.RemotePlayPause,
  Event.RemoteStop,
  Event.RemoteNext,
  Event.RemotePrevious,
  Event.RemoteDuck,
];
