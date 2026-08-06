export {
  setupPlayer,
  updateOptions,
  add,
  updateNowPlayingMetadata,
  updateMetadataForTrack,
  play,
  pause,
  seekTo,
  getProgress,
  getPlaybackState,
  getPlayWhenReady,
  setPlayWhenReady,
  reset,
  getPlayerOptions,
} from './Player';

export { State } from './State';
export type { PlaybackState } from './State';
export type { Track, TrackType, Progress } from './Track';
export { Capability, DEFAULT_CAPABILITIES } from './Capability';
export type { CapabilityValue } from './Capability';
export { AppKilledPlaybackBehavior, DEFAULT_PLAYER_OPTIONS, mergePlayerOptions } from './Options';
export type { PlayerOptions, PlayerOptionsInput, AppKilledPlaybackBehaviorValue } from './Options';
export type { NowPlayingMetadata } from './Metadata';
export { PlayerErrorCode, PlayerException, isPlayerException } from './errors';
export type { PlayerError, PlayerErrorCodeValue } from './errors';
