export const PlayerErrorCode = {
  NotInitialized: 'not_initialized',
  NoSource: 'no_source',
  InvalidArgument: 'invalid_argument',
  UnsupportedUrl: 'unsupported_url',
  UnsupportedType: 'unsupported_type',
  LoadFailed: 'load_failed',
  PlaybackFailed: 'playback_failed',
  PlatformUnsupported: 'platform_unsupported',
  SetupTimeout: 'setup_timeout',
} as const;

export type PlayerErrorCodeValue = (typeof PlayerErrorCode)[keyof typeof PlayerErrorCode];

export type PlayerError = {
  code: PlayerErrorCodeValue;
  message: string;
};

export class PlayerException extends Error {
  readonly code: PlayerErrorCodeValue;

  constructor(code: PlayerErrorCodeValue, message: string) {
    super(message);
    this.name = 'PlayerException';
    this.code = code;
  }

  toJSON(): PlayerError {
    return { code: this.code, message: this.message };
  }
}

export function isPlayerException(error: unknown): error is PlayerException {
  return error instanceof PlayerException;
}
