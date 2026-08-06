import { Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import { mergeForcedMetadata, trackToNativePayload, type NowPlayingMetadata } from './Metadata';
import {
  DEFAULT_PLAYER_OPTIONS,
  mergePlayerOptions,
  optionsToNativeMap,
  type PlayerOptions,
  type PlayerOptionsInput,
} from './Options';
import type { Progress, Track } from './Track';
import { PlayerErrorCode, PlayerException } from './errors';
import { normalizeTrackUrl } from './normalizeTrackUrl';

/** Persisted options survive reset() (Bible contract). */
let persistedOptions: PlayerOptions = {
  ...DEFAULT_PLAYER_OPTIONS,
  capabilities: [...DEFAULT_PLAYER_OPTIONS.capabilities],
};

/** Current track metadata (single-source T3/T4). Cleared on reset. */
let currentTrackMeta: NowPlayingMetadata | null = null;

/** Forced now-playing override. Cleared on reset. */
let forcedNowPlaying: NowPlayingMetadata | null = null;

function ensureNative(): typeof NativeModule {
  if (Platform.OS === 'web') {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player transport APIs are not supported on web'
    );
  }
  return NativeModule;
}

function rethrowNative(error: unknown): never {
  if (error instanceof PlayerException) {
    throw error;
  }
  const anyErr = error as { code?: string; message?: string } | null;
  if (anyErr && typeof anyErr.code === 'string') {
    const code = anyErr.code as (typeof PlayerErrorCode)[keyof typeof PlayerErrorCode];
    const known = Object.values(PlayerErrorCode) as string[];
    if (known.includes(anyErr.code)) {
      throw new PlayerException(code, anyErr.message ?? anyErr.code);
    }
  }
  throw error instanceof Error ? error : new Error(String(error));
}

function assertNewArchitecture(): void {
  // Bridgeless / New Arch is required. TurboModuleProxy absence is a weak signal on some hosts;
  // prefer global flag when present.
  const g = globalThis as { RN$Bridgeless?: boolean; __turboModuleProxy?: unknown };
  if (g.RN$Bridgeless === false) {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player requires the New Architecture'
    );
  }
}

export function getPlayerOptions(): PlayerOptions {
  return {
    ...persistedOptions,
    capabilities: [...persistedOptions.capabilities],
  };
}

export async function setupPlayer(options?: PlayerOptionsInput): Promise<void> {
  assertNewArchitecture();
  if (options) {
    persistedOptions = mergePlayerOptions(persistedOptions, options);
  }
  try {
    await ensureNative().setupPlayer(optionsToNativeMap(persistedOptions));
  } catch (e) {
    rethrowNative(e);
  }
}

export async function updateOptions(options?: PlayerOptionsInput): Promise<void> {
  persistedOptions = mergePlayerOptions(persistedOptions, options ?? {});
  try {
    await ensureNative().updateOptions(optionsToNativeMap(persistedOptions));
  } catch (e) {
    rethrowNative(e);
  }
}

export async function add(trackOrTracks: Track | Track[]): Promise<void> {
  const tracks = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
  if (tracks.length === 0) {
    throw new PlayerException(PlayerErrorCode.InvalidArgument, 'add() requires at least one track');
  }
  const track = tracks[0];
  if (track.type === 'hls') {
    throw new PlayerException(
      PlayerErrorCode.UnsupportedType,
      'HLS is not supported until T9; use progressive urls'
    );
  }
  const url = normalizeTrackUrl(track.url);
  // content:// is Android-only
  if (url.toLowerCase().startsWith('content:') && Platform.OS === 'ios') {
    throw new PlayerException(PlayerErrorCode.UnsupportedUrl, 'content:// urls are Android-only');
  }

  currentTrackMeta = {
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.artwork,
  };
  // New add clears forced override unless host re-applies updateNowPlayingMetadata
  forcedNowPlaying = null;

  const payload = trackToNativePayload(
    url,
    {
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
    },
    persistedOptions.autoUpdateMetadata
  );

  try {
    await ensureNative().add(payload);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function updateNowPlayingMetadata(metadata: NowPlayingMetadata): Promise<void> {
  if (!metadata || typeof metadata !== 'object') {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'updateNowPlayingMetadata requires an object'
    );
  }
  forcedNowPlaying = mergeForcedMetadata(forcedNowPlaying ?? {}, metadata);
  try {
    await ensureNative().updateNowPlayingMetadata({ ...forcedNowPlaying });
  } catch (e) {
    rethrowNative(e);
  }
}

export async function updateMetadataForTrack(
  index: number,
  metadata: NowPlayingMetadata
): Promise<void> {
  if (!Number.isInteger(index) || index !== 0) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'updateMetadataForTrack only supports index 0 until T6'
    );
  }
  if (!metadata || typeof metadata !== 'object') {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'updateMetadataForTrack requires an object'
    );
  }
  currentTrackMeta = mergeForcedMetadata(currentTrackMeta ?? {}, metadata);
  if (persistedOptions.autoUpdateMetadata && !forcedNowPlaying) {
    try {
      await ensureNative().updateNowPlayingMetadata({ ...currentTrackMeta });
    } catch (e) {
      rethrowNative(e);
    }
  } else if (forcedNowPlaying) {
    // Forced still wins — push merge for native display
    try {
      await ensureNative().updateNowPlayingMetadata({
        ...currentTrackMeta,
        ...forcedNowPlaying,
      });
    } catch (e) {
      rethrowNative(e);
    }
  }
}

export async function play(): Promise<void> {
  try {
    await ensureNative().play();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function pause(): Promise<void> {
  try {
    await ensureNative().pause();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function seekTo(positionSeconds: number): Promise<void> {
  if (
    typeof positionSeconds !== 'number' ||
    !Number.isFinite(positionSeconds) ||
    positionSeconds < 0
  ) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'seekTo requires a finite position >= 0 (seconds)'
    );
  }
  try {
    await ensureNative().seekTo(positionSeconds);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getProgress(): Promise<Progress> {
  try {
    const progress = await ensureNative().getProgress();
    return {
      position: Number(progress?.position) || 0,
      duration: Number(progress?.duration) || 0,
      buffered: Number(progress?.buffered) || 0,
    };
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getPlaybackState(): Promise<string> {
  try {
    return await ensureNative().getPlaybackState();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getPlayWhenReady(): Promise<boolean> {
  try {
    return await ensureNative().getPlayWhenReady();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function setPlayWhenReady(value: boolean): Promise<void> {
  try {
    await ensureNative().setPlayWhenReady(!!value);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function reset(): Promise<void> {
  currentTrackMeta = null;
  forcedNowPlaying = null;
  // Options intentionally persist across reset
  try {
    await ensureNative().reset();
  } catch (e) {
    rethrowNative(e);
  }
}

/** @internal test helper — reset JS option/metadata state between tests */
export function __resetPlayerJsStateForTests(): void {
  persistedOptions = {
    ...DEFAULT_PLAYER_OPTIONS,
    capabilities: [...DEFAULT_PLAYER_OPTIONS.capabilities],
  };
  currentTrackMeta = null;
  forcedNowPlaying = null;
}
