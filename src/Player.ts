import { Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import type { Progress, Track } from './Track';
import { PlayerErrorCode, PlayerException } from './errors';
import { normalizeTrackUrl } from './normalizeTrackUrl';

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

export async function setupPlayer(_options?: Record<string, unknown>): Promise<void> {
  try {
    await ensureNative().setupPlayer(_options ?? {});
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
  try {
    await ensureNative().add(url);
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
  try {
    await ensureNative().reset();
  } catch (e) {
    rethrowNative(e);
  }
}
