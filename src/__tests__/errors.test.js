const { PlayerErrorCode, PlayerException, isPlayerException } = require('../errors');

describe('PlayerErrorCode', () => {
  it('exposes stable T3 codes plus setup_timeout', () => {
    expect(PlayerErrorCode).toEqual({
      NotInitialized: 'not_initialized',
      NoSource: 'no_source',
      InvalidArgument: 'invalid_argument',
      UnsupportedUrl: 'unsupported_url',
      UnsupportedType: 'unsupported_type',
      LoadFailed: 'load_failed',
      PlaybackFailed: 'playback_failed',
      PlatformUnsupported: 'platform_unsupported',
      SetupTimeout: 'setup_timeout',
    });
  });
});

describe('PlayerException', () => {
  it('carries code and message', () => {
    const err = new PlayerException(PlayerErrorCode.NoSource, 'No media');
    expect(err.code).toBe('no_source');
    expect(err.message).toBe('No media');
    expect(err.toJSON()).toEqual({ code: 'no_source', message: 'No media' });
    expect(isPlayerException(err)).toBe(true);
    expect(isPlayerException(new Error('x'))).toBe(false);
  });
});
