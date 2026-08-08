const { PlayerErrorCode } = require('../errors');
const { normalizeTrackUrl } = require('../normalizeTrackUrl');

describe('normalizeTrackUrl', () => {
  it('accepts https', () => {
    expect(normalizeTrackUrl('https://example.com/a.mp3')).toBe('https://example.com/a.mp3');
  });

  it('accepts http', () => {
    expect(normalizeTrackUrl('http://example.com/a.mp3')).toBe('http://example.com/a.mp3');
  });

  it('accepts file', () => {
    expect(normalizeTrackUrl('file:///tmp/a.wav')).toBe('file:///tmp/a.wav');
  });

  it('accepts content', () => {
    expect(normalizeTrackUrl('content://media/external/audio/1')).toBe(
      'content://media/external/audio/1'
    );
  });

  it('trims whitespace', () => {
    expect(normalizeTrackUrl('  https://example.com/a.mp3  ')).toBe('https://example.com/a.mp3');
  });

  it('rejects empty string', () => {
    expect(() => normalizeTrackUrl('')).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects whitespace-only', () => {
    expect(() => normalizeTrackUrl('   ')).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects non-string', () => {
    expect(() => normalizeTrackUrl(42)).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects relative paths', () => {
    expect(() => normalizeTrackUrl('assets/a.wav')).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.UnsupportedUrl })
    );
  });

  it('rejects unsupported schemes', () => {
    expect(() => normalizeTrackUrl('ph://asset/1')).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.UnsupportedUrl })
    );
  });

  it('rejects silence scheme on progressive path', () => {
    expect(() => normalizeTrackUrl('silence:800')).toThrow(
      expect.objectContaining({ code: PlayerErrorCode.UnsupportedUrl })
    );
  });
});
