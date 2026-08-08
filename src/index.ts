export {
  setupPlayer,
  updateOptions,
  add,
  remove,
  getQueue,
  getActiveTrack,
  getActiveTrackIndex,
  skip,
  skipToNext,
  skipToPrevious,
  updateNowPlayingMetadata,
  updateMetadataForTrack,
  play,
  pause,
  seekTo,
  getProgress,
  getPlaybackState,
  getPlayWhenReady,
  setPlayWhenReady,
  setRate,
  reset,
  getPlayerOptions,
} from './Player';

export {
  ambientSetPlaylist,
  ambientPlay,
  ambientPause,
  ambientStop,
  ambientSetVolume,
  ambientFade,
} from './Ambient';

export { State } from './State';
export type { PlaybackState } from './State';
export { TrackType } from './Track';
export type { Track, TrackTypeValue, Progress } from './Track';
export { createSilenceTrack, isSilenceTrack, MAX_SILENCE_DURATION_MS } from './createSilenceTrack';
export type { CreateSilenceTrackOptions } from './createSilenceTrack';
export { Capability, DEFAULT_CAPABILITIES } from './Capability';
export type { CapabilityValue } from './Capability';
export { AppKilledPlaybackBehavior, DEFAULT_PLAYER_OPTIONS, mergePlayerOptions } from './Options';
export type { PlayerOptions, PlayerOptionsInput, AppKilledPlaybackBehaviorValue } from './Options';
export type { NowPlayingMetadata } from './Metadata';
export { PlayerErrorCode, PlayerException, isPlayerException } from './errors';
export type { PlayerError, PlayerErrorCodeValue } from './errors';
export type { PlaybackStateResult } from './Player';

export {
  Event,
  HEADLESS_TASK_NAME,
  REMOTE_EVENT_NAMES,
  PLAYBACK_EVENT_NAMES,
  ALL_EVENT_NAMES,
} from './Event';
export type {
  EventType,
  RemoteDuckEvent,
  PlaybackActiveTrackChangedEvent,
  PlaybackStateEvent,
  PlaybackQueueEndedEvent,
  PlaybackErrorEvent,
  PlaybackProgressUpdatedEvent,
  PlaybackPlayWhenReadyChangedEvent,
} from './Event';
export { addEventListener, registerPlaybackService } from './registerPlaybackService';
export type {
  EventSubscription,
  PlaybackServiceFactory,
  ServiceHandler,
} from './registerPlaybackService';
