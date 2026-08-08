const {
  createSilenceTrack,
  isSilenceTrack,
  canonicalizeSilence,
  MAX_SILENCE_DURATION_MS,
} = require('../createSilenceTrack');
const { PlayerErrorCode } = require('../errors');

describe('createSilenceTrack', () => {
  it('returns canonical track for durationMs 800', () => {
    expect(createSilenceTrack({ durationMs: 800 })).toEqual({
      type: 'silence',
      url: 'silence:800',
      duration: 0.8,
    });
  });

  it('honors optional id', () => {
    expect(createSilenceTrack({ durationMs: 500, id: 'pause-1' })).toEqual({
      type: 'silence',
      url: 'silence:500',
      duration: 0.5,
      id: 'pause-1',
    });
  });

  it('accepts bounds 1 and MAX', () => {
    expect(createSilenceTrack({ durationMs: 1 }).url).toBe('silence:1');
    expect(createSilenceTrack({ durationMs: MAX_SILENCE_DURATION_MS }).url).toBe(
      `silence:${MAX_SILENCE_DURATION_MS}`
    );
  });

  it.each([0, -1, 300001, 1.5, NaN, Infinity, undefined])(
    'rejects invalid durationMs %p',
    (durationMs) => {
      expect(() => createSilenceTrack({ durationMs })).toThrow(
        expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
      );
    }
  );

  it('rejects missing options', () => {
    expect(() => createSilenceTrack()).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects empty id', () => {
    expect(() => createSilenceTrack({ durationMs: 100, id: '' })).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });
});

describe('isSilenceTrack', () => {
  it('is true only for type silence', () => {
    expect(isSilenceTrack(createSilenceTrack({ durationMs: 100 }))).toBe(true);
    expect(isSilenceTrack({ url: 'https://example.com/a.mp3' })).toBe(false);
    expect(isSilenceTrack({ url: 'silence:100' })).toBe(false);
    expect(isSilenceTrack(null)).toBe(false);
    expect(isSilenceTrack(undefined)).toBe(false);
  });
});

describe('canonicalizeSilence', () => {
  it('accepts already-canonical manual track', () => {
    expect(
      canonicalizeSilence({
        type: 'silence',
        url: 'silence:1000',
        duration: 1,
      })
    ).toEqual({
      durationMs: 1000,
      url: 'silence:1000',
      duration: 1,
    });
  });

  it('rejects type silence with progressive url', () => {
    expect(() =>
      canonicalizeSilence({ type: 'silence', url: 'https://example.com/a.wav' })
    ).toThrow(expect.objectContaining({ code: PlayerErrorCode.InvalidArgument }));
  });

  it('rejects silence url without silence type', () => {
    expect(() => canonicalizeSilence({ url: 'silence:800' })).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects mismatched duration vs url ms', () => {
    expect(() => canonicalizeSilence({ type: 'silence', url: 'silence:800', duration: 1 })).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });
});
