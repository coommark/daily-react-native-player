const {
  trackToNativePayload,
  mergeForcedMetadata,
  resolveDisplayMetadata,
} = require('../Metadata');

describe('Metadata helpers', () => {
  it('url-only payload when autoUpdateMetadata false', () => {
    expect(trackToNativePayload('https://x/a.mp3', { title: 'T' }, false)).toEqual({
      url: 'https://x/a.mp3',
    });
  });

  it('includes non-empty metadata when auto', () => {
    expect(
      trackToNativePayload('https://x/a.mp3', { title: 'T', artist: '', album: 'A' }, true)
    ).toEqual({ url: 'https://x/a.mp3', title: 'T', album: 'A' });
  });

  it('forced metadata merges and clears empty string', () => {
    const merged = mergeForcedMetadata({ title: 'A', artist: 'B' }, { title: '', album: 'C' });
    expect(merged.title).toBeUndefined();
    expect(merged.artist).toBe('B');
    expect(merged.album).toBe('C');
  });

  it('resolveDisplayMetadata prefers forced', () => {
    const resolved = resolveDisplayMetadata({ title: 'Track' }, { title: 'Forced' }, true);
    expect(resolved.title).toBe('Forced');
  });
});
