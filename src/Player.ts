import { Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import { mergeForcedMetadata, type NowPlayingMetadata } from './Metadata';
import {
  DEFAULT_PLAYER_OPTIONS,
  mergePlayerOptions,
  optionsToNativeMap,
  type PlayerOptions,
  type PlayerOptionsInput,
} from './Options';
import type { PlaybackState } from './State';
import type { Progress, Track, TrackTypeValue } from './Track';
import { canonicalizeSilence } from './createSilenceTrack';
import { PlayerErrorCode, PlayerException } from './errors';
import { normalizeTrackUrl } from './normalizeTrackUrl';

/** Result of {@link getPlaybackState}. */
export type PlaybackStateResult = { state: PlaybackState };
/** Persisted options survive reset() (Bible contract). */
let persistedOptions: PlayerOptions = {
  ...DEFAULT_PLAYER_OPTIONS,
  capabilities: [...DEFAULT_PLAYER_OPTIONS.capabilities],
};

/** Forced now-playing overlay. Cleared on reset or when adding to an empty queue. */
let forcedNowPlaying: NowPlayingMetadata | null = null;

/** In-flight setup coalesce — concurrent callers share one native setup. */
let setupPromise: Promise<void> | null = null;

const SETUP_TIMEOUT_MS = 10_000;

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
  const g = globalThis as { RN$Bridgeless?: boolean; __turboModuleProxy?: unknown };
  if (g.RN$Bridgeless === false) {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player requires the New Architecture'
    );
  }
}

function applyMetadataToPayload(track: Track, payload: Record<string, unknown>): void {
  if (!persistedOptions.autoUpdateMetadata) {
    return;
  }
  if (typeof track.title === 'string' && track.title.length > 0) payload.title = track.title;
  if (typeof track.artist === 'string' && track.artist.length > 0) payload.artist = track.artist;
  if (typeof track.album === 'string' && track.album.length > 0) payload.album = track.album;
  if (typeof track.artwork === 'string' && track.artwork.length > 0)
    payload.artwork = track.artwork;
}

function isSilenceCandidate(track: Track): boolean {
  return (
    track.type === 'silence' ||
    (typeof track.url === 'string' && track.url.trim().startsWith('silence:'))
  );
}

function validateTrack(track: Track): { url: string; payload: Record<string, unknown> } {
  if (isSilenceCandidate(track)) {
    const silence = canonicalizeSilence(track);
    const payload: Record<string, unknown> = {
      type: 'silence',
      url: silence.url,
      durationMs: silence.durationMs,
      duration: silence.duration,
    };
    if (silence.id) payload.id = silence.id;
    applyMetadataToPayload(track, payload);
    return { url: silence.url, payload };
  }

  const url = normalizeTrackUrl(track.url);
  if (url.toLowerCase().startsWith('content:') && Platform.OS === 'ios') {
    throw new PlayerException(PlayerErrorCode.UnsupportedUrl, 'content:// urls are Android-only');
  }

  let type: TrackTypeValue | undefined =
    track.type === 'hls' || track.type === 'default' ? track.type : undefined;
  if (!type && looksLikeHlsUrl(url)) {
    type = 'hls';
  }
  if (
    track.type != null &&
    track.type !== 'hls' &&
    track.type !== 'default' &&
    track.type !== 'silence'
  ) {
    throw new PlayerException(
      PlayerErrorCode.UnsupportedType,
      `Unsupported track type: ${String(track.type)}`
    );
  }

  const payload: Record<string, unknown> = { url };
  if (type) payload.type = type;
  if (typeof track.id === 'string' && track.id.length > 0) {
    payload.id = track.id;
  }
  applyMetadataToPayload(track, payload);
  return { url, payload };
}

function looksLikeHlsUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? '';
  return path.endsWith('.m3u8');
}

function normalizeTrackFromNative(
  raw: Record<string, unknown> | null | undefined
): Track | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const url = raw.url;
  if (typeof url !== 'string' || !url) {
    return undefined;
  }
  const track: Track = { url };
  if (typeof raw.id === 'string') track.id = raw.id;
  if (typeof raw.title === 'string') track.title = raw.title;
  if (typeof raw.artist === 'string') track.artist = raw.artist;
  if (typeof raw.album === 'string') track.album = raw.album;
  if (typeof raw.artwork === 'string') track.artwork = raw.artwork;

  const rawType = raw.type;
  if (rawType === 'silence' || rawType === 'hls' || rawType === 'default') {
    track.type = rawType as TrackTypeValue;
  }

  if (typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs > 0) {
    track.duration = raw.durationMs / 1000;
  } else if (
    typeof raw.duration === 'number' &&
    Number.isFinite(raw.duration) &&
    raw.duration > 0
  ) {
    track.duration = raw.duration;
  }

  if (track.type === 'silence' && track.duration == null) {
    const m = /^silence:(\d+)$/.exec(url);
    if (m) {
      track.duration = Number(m[1]) / 1000;
    }
  }

  return track;
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

  if (setupPromise) {
    await setupPromise;
    return;
  }

  const nativeCall = (async () => {
    try {
      await ensureNative().setupPlayer(optionsToNativeMap(persistedOptions));
    } catch (e) {
      rethrowNative(e);
    }
  })();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timed = Promise.race([
    nativeCall.finally(() => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new PlayerException(
            PlayerErrorCode.SetupTimeout,
            `setupPlayer timed out after ${SETUP_TIMEOUT_MS}ms`
          )
        );
      }, SETUP_TIMEOUT_MS);
    }),
  ]);

  setupPromise = timed.finally(() => {
    setupPromise = null;
  });

  try {
    await setupPromise;
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

/**
 * Append tracks, or insert before `insertBeforeIndex`.
 * Returns inserted indices. Empty queue + add loads the first item.
 * Hosts that previously relied on replace must `reset()` then `add()`.
 */
export async function add(
  trackOrTracks: Track | Track[],
  insertBeforeIndex?: number
): Promise<number[]> {
  const tracks = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
  if (tracks.length === 0) {
    throw new PlayerException(PlayerErrorCode.InvalidArgument, 'add() requires at least one track');
  }
  if (
    insertBeforeIndex !== undefined &&
    (!Number.isInteger(insertBeforeIndex) || insertBeforeIndex < 0)
  ) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'insertBeforeIndex must be a non-negative integer'
    );
  }

  const payloads = tracks.map(
    (t) =>
      validateTrack(t).payload as {
        url: string;
        id?: string;
        title?: string;
        artist?: string;
        album?: string;
        artwork?: string;
      }
  );

  try {
    const native = ensureNative();
    const prevIndex = await native.getActiveTrackIndex();
    const wasEmpty = prevIndex == null;
    const indices = await native.add(
      payloads,
      insertBeforeIndex === undefined ? null : insertBeforeIndex
    );
    if (wasEmpty) {
      forcedNowPlaying = null;
    }
    return Array.isArray(indices) ? indices.map((n) => Number(n)) : [];
  } catch (e) {
    rethrowNative(e);
  }
}

export async function remove(indexes: number | number[]): Promise<void> {
  const list = Array.isArray(indexes) ? indexes : [indexes];
  if (list.length === 0) {
    return;
  }
  for (const i of list) {
    if (!Number.isInteger(i) || i < 0) {
      throw new PlayerException(
        PlayerErrorCode.InvalidArgument,
        'remove() indexes must be non-negative integers'
      );
    }
  }
  try {
    await ensureNative().remove(list);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getQueue(): Promise<Track[]> {
  try {
    const raw = await ensureNative().getQueue();
    return (raw ?? []).map((t) => normalizeTrackFromNative(t)).filter((t): t is Track => !!t);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getActiveTrack(): Promise<Track | undefined> {
  try {
    const raw = await ensureNative().getActiveTrack();
    return normalizeTrackFromNative(raw ?? undefined);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function getActiveTrackIndex(): Promise<number | undefined> {
  try {
    const index = await ensureNative().getActiveTrackIndex();
    if (index == null || typeof index !== 'number' || !Number.isFinite(index)) {
      return undefined;
    }
    return index;
  } catch (e) {
    rethrowNative(e);
  }
}

export async function skip(index: number): Promise<void> {
  if (!Number.isInteger(index) || index < 0) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'skip() requires a non-negative index'
    );
  }
  try {
    await ensureNative().skip(index);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function skipToNext(): Promise<void> {
  try {
    await ensureNative().skipToNext();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function skipToPrevious(): Promise<void> {
  try {
    await ensureNative().skipToPrevious();
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
  if (!Number.isInteger(index) || index < 0) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'updateMetadataForTrack requires a non-negative index'
    );
  }
  if (!metadata || typeof metadata !== 'object') {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'updateMetadataForTrack requires an object'
    );
  }
  try {
    const native = ensureNative();
    await native.updateMetadataForTrack(index, { ...metadata });
    if (forcedNowPlaying) {
      await native.updateNowPlayingMetadata({ ...forcedNowPlaying });
    }
  } catch (e) {
    rethrowNative(e);
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

export async function getPlaybackState(): Promise<PlaybackStateResult> {
  try {
    const state = await ensureNative().getPlaybackState();
    return { state: state as PlaybackState };
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

/**
 * Set playback rate. Engine accepts `[0.25, 4.0]`; hosts clamp product UX.
 * While a silence track is active, native forces effective rate `1.0` without
 * clearing the desired rate.
 */
export async function setRate(rate: number): Promise<void> {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.25 || rate > 4.0) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'setRate requires a finite rate in [0.25, 4.0]'
    );
  }
  try {
    await ensureNative().setRate(rate);
  } catch (e) {
    rethrowNative(e);
  }
}

export async function reset(): Promise<void> {
  forcedNowPlaying = null;
  try {
    const native = ensureNative();
    await native.reset();
    await native.updateOptions(optionsToNativeMap(persistedOptions));
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
  forcedNowPlaying = null;
  setupPromise = null;
}
