/**
 * Events delivered to `registerPlaybackService` / `addEventListener`.
 * Wire names are kebab-case (public contract; must match native Expo Events).
 */

import type { PlaybackState } from './State';
import type { Progress, Track } from './Track';

export const HEADLESS_TASK_NAME = 'DailyReactNativePlayer';

export const Event = {
  // Remote / policy (T5)
  RemotePlay: 'remote-play',
  RemotePause: 'remote-pause',
  RemotePlayPause: 'remote-play-pause',
  RemoteStop: 'remote-stop',
  RemoteNext: 'remote-next',
  RemotePrevious: 'remote-previous',
  RemoteDuck: 'remote-duck',
  // Playback lifecycle (T6)
  PlaybackActiveTrackChanged: 'playback-active-track-changed',
  PlaybackState: 'playback-state',
  PlaybackQueueEnded: 'playback-queue-ended',
  PlaybackError: 'playback-error',
  PlaybackProgressUpdated: 'playback-progress-updated',
  PlaybackPlayWhenReadyChanged: 'playback-play-when-ready-changed',
} as const;

export type EventType = (typeof Event)[keyof typeof Event];

/** Payload for {@link Event.RemoteDuck}. */
export type RemoteDuckEvent = {
  paused: boolean;
  permanent: boolean;
};

/** Payload for {@link Event.PlaybackActiveTrackChanged}. */
export type PlaybackActiveTrackChangedEvent = {
  index: number | null;
  track: Track | null;
  lastIndex: number | null;
  lastTrack: Track | null;
};

/** Payload for {@link Event.PlaybackState}. */
export type PlaybackStateEvent = {
  state: PlaybackState;
};

/** Payload for {@link Event.PlaybackQueueEnded}. */
export type PlaybackQueueEndedEvent = {
  track: Track | null;
  index: number | null;
  position: number;
};

/** Payload for {@link Event.PlaybackError}. */
export type PlaybackErrorEvent = {
  code: string;
  message: string;
  trackId?: string;
  index?: number;
};

/** Payload for {@link Event.PlaybackProgressUpdated}. */
export type PlaybackProgressUpdatedEvent = Progress;

/** Payload for {@link Event.PlaybackPlayWhenReadyChanged}. */
export type PlaybackPlayWhenReadyChangedEvent = {
  playWhenReady: boolean;
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

/** Playback* event wire names (T6). */
export const PLAYBACK_EVENT_NAMES: readonly EventType[] = [
  Event.PlaybackActiveTrackChanged,
  Event.PlaybackState,
  Event.PlaybackQueueEnded,
  Event.PlaybackError,
  Event.PlaybackProgressUpdated,
  Event.PlaybackPlayWhenReadyChanged,
];

/** All module event wire names (Remote* + Playback*). */
export const ALL_EVENT_NAMES: readonly EventType[] = [
  ...REMOTE_EVENT_NAMES,
  ...PLAYBACK_EVENT_NAMES,
];
