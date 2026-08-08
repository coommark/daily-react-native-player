import { CapabilityValue, DEFAULT_CAPABILITIES } from './Capability';

/** Android app-killed / task-removed behavior. */
export const AppKilledPlaybackBehavior = {
  ContinuePlayback: 'continue-playback',
  PausePlayback: 'pause-playback',
  StopPlaybackAndRemoveNotification: 'stop-playback-and-remove-notification',
} as const;

export type AppKilledPlaybackBehaviorValue =
  (typeof AppKilledPlaybackBehavior)[keyof typeof AppKilledPlaybackBehavior];

export type PlayerOptions = {
  capabilities: CapabilityValue[];
  autoUpdateMetadata: boolean;
  appKilledPlaybackBehavior: AppKilledPlaybackBehaviorValue;
  /** Seconds before demoting FGS after pause/stop. */
  stopForegroundGracePeriod: number;
  autoHandleInterruptions: boolean;
  /**
   * Seconds between `playback-progress-updated` events.
   * `0` disables progress events. Default `1` (Bible).
   */
  progressUpdateEventInterval: number;
  /**
   * Mix with other apps when ambient is active.
   * `duckOthers` adds iOS `.duckOthers`; Android ambient never requests focus.
   */
  androidAudioMixMode: 'default' | 'duckOthers';
  /** Verbose native/JS logs. Off by default; no PII. */
  debug: boolean;
};

export type PlayerOptionsInput = Partial<{
  capabilities: CapabilityValue[];
  autoUpdateMetadata: boolean;
  appKilledPlaybackBehavior: AppKilledPlaybackBehaviorValue;
  stopForegroundGracePeriod: number;
  autoHandleInterruptions: boolean;
  progressUpdateEventInterval: number;
  androidAudioMixMode: 'default' | 'duckOthers';
  debug: boolean;
}>;

export const DEFAULT_PLAYER_OPTIONS: PlayerOptions = {
  capabilities: [...DEFAULT_CAPABILITIES],
  autoUpdateMetadata: true,
  appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
  stopForegroundGracePeriod: 5,
  autoHandleInterruptions: false,
  progressUpdateEventInterval: 1,
  androidAudioMixMode: 'default',
  debug: false,
};

const VALID_KILL = new Set<string>(Object.values(AppKilledPlaybackBehavior));
const VALID_CAP = new Set<string>(['play', 'pause', 'stop', 'skipToNext', 'skipToPrevious']);

function normalizeCapabilities(input: unknown): CapabilityValue[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    return undefined;
  }
  const out: CapabilityValue[] = [];
  for (const item of input) {
    if (typeof item === 'string' && VALID_CAP.has(item)) {
      out.push(item as CapabilityValue);
    }
  }
  return out;
}

/**
 * Deep-merge partial options onto a base. Invalid fields are ignored (kept from base).
 */
export function mergePlayerOptions(
  base: PlayerOptions,
  partial?: PlayerOptionsInput | Record<string, unknown> | null
): PlayerOptions {
  if (!partial || typeof partial !== 'object') {
    return {
      ...base,
      capabilities: [...base.capabilities],
    };
  }
  const next: PlayerOptions = {
    ...base,
    capabilities: [...base.capabilities],
  };

  const caps = normalizeCapabilities(partial.capabilities);
  if (caps !== undefined) {
    next.capabilities = caps;
  }

  if (typeof partial.autoUpdateMetadata === 'boolean') {
    next.autoUpdateMetadata = partial.autoUpdateMetadata;
  }

  if (
    typeof partial.appKilledPlaybackBehavior === 'string' &&
    VALID_KILL.has(partial.appKilledPlaybackBehavior)
  ) {
    next.appKilledPlaybackBehavior =
      partial.appKilledPlaybackBehavior as AppKilledPlaybackBehaviorValue;
  }

  if (
    typeof partial.stopForegroundGracePeriod === 'number' &&
    Number.isFinite(partial.stopForegroundGracePeriod) &&
    partial.stopForegroundGracePeriod >= 0
  ) {
    next.stopForegroundGracePeriod = partial.stopForegroundGracePeriod;
  }

  if (typeof partial.autoHandleInterruptions === 'boolean') {
    next.autoHandleInterruptions = partial.autoHandleInterruptions;
  }

  if (
    typeof partial.progressUpdateEventInterval === 'number' &&
    Number.isFinite(partial.progressUpdateEventInterval) &&
    partial.progressUpdateEventInterval >= 0
  ) {
    next.progressUpdateEventInterval = partial.progressUpdateEventInterval;
  }

  if (partial.androidAudioMixMode === 'default' || partial.androidAudioMixMode === 'duckOthers') {
    next.androidAudioMixMode = partial.androidAudioMixMode;
  }

  if (typeof partial.debug === 'boolean') {
    next.debug = partial.debug;
  }

  return next;
}

/** Serialize options for the native bridge (plain JSON-safe map). */
export function optionsToNativeMap(options: PlayerOptions): Record<string, unknown> {
  return {
    capabilities: [...options.capabilities],
    autoUpdateMetadata: options.autoUpdateMetadata,
    appKilledPlaybackBehavior: options.appKilledPlaybackBehavior,
    stopForegroundGracePeriod: options.stopForegroundGracePeriod,
    autoHandleInterruptions: options.autoHandleInterruptions,
    progressUpdateEventInterval: options.progressUpdateEventInterval,
    androidAudioMixMode: options.androidAudioMixMode,
    debug: options.debug,
  };
}
