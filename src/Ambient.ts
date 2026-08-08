import { Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import { PlayerErrorCode, PlayerException } from './errors';

function ensureNative(): typeof NativeModule {
  if (Platform.OS === 'web') {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player ambient APIs are not supported on web'
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

/** Replace ambient playlist. `loopAll` false = loop-one; true = advance then wrap. */
export async function ambientSetPlaylist(urls: string[], loopAll = false): Promise<void> {
  if (!Array.isArray(urls)) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'ambientSetPlaylist requires a url array'
    );
  }
  for (const u of urls) {
    if (typeof u !== 'string' || u.trim().length === 0) {
      throw new PlayerException(
        PlayerErrorCode.InvalidArgument,
        'ambientSetPlaylist urls must be non-empty strings'
      );
    }
  }
  try {
    await ensureNative().ambientSetPlaylist(
      urls.map((u) => u.trim()),
      !!loopAll
    );
  } catch (e) {
    rethrowNative(e);
  }
}

export async function ambientPlay(): Promise<void> {
  try {
    await ensureNative().ambientPlay();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function ambientPause(): Promise<void> {
  try {
    await ensureNative().ambientPause();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function ambientStop(): Promise<void> {
  try {
    await ensureNative().ambientStop();
  } catch (e) {
    rethrowNative(e);
  }
}

export async function ambientSetVolume(level: number): Promise<void> {
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 0 || level > 1) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'ambientSetVolume requires a finite level in [0, 1]'
    );
  }
  try {
    await ensureNative().ambientSetVolume(level);
  } catch (e) {
    rethrowNative(e);
  }
}

/** Fire-and-forget volume ramp; cancelled by new fade / setVolume / pause / stop. */
export async function ambientFade(target: number, durationMs: number): Promise<void> {
  if (typeof target !== 'number' || !Number.isFinite(target) || target < 0 || target > 1) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'ambientFade target requires a finite level in [0, 1]'
    );
  }
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'ambientFade durationMs must be a finite number >= 0'
    );
  }
  try {
    await ensureNative().ambientFade(target, durationMs);
  } catch (e) {
    rethrowNative(e);
  }
}
