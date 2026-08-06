const { Capability } = require('../Capability');
const {
  DEFAULT_PLAYER_OPTIONS,
  mergePlayerOptions,
  AppKilledPlaybackBehavior,
  optionsToNativeMap,
} = require('../Options');

describe('mergePlayerOptions', () => {
  it('returns defaults copy when partial empty', () => {
    const merged = mergePlayerOptions(DEFAULT_PLAYER_OPTIONS, {});
    expect(merged.autoUpdateMetadata).toBe(true);
    expect(merged.appKilledPlaybackBehavior).toBe(AppKilledPlaybackBehavior.ContinuePlayback);
    expect(merged.stopForegroundGracePeriod).toBe(5);
    expect(merged.capabilities).toContain(Capability.Play);
  });

  it('merges valid fields and ignores invalid', () => {
    const merged = mergePlayerOptions(DEFAULT_PLAYER_OPTIONS, {
      autoUpdateMetadata: false,
      appKilledPlaybackBehavior: 'not-a-real-value',
      stopForegroundGracePeriod: -1,
      capabilities: [Capability.Play, 'bogus', Capability.Pause],
    });
    expect(merged.autoUpdateMetadata).toBe(false);
    expect(merged.appKilledPlaybackBehavior).toBe(AppKilledPlaybackBehavior.ContinuePlayback);
    expect(merged.stopForegroundGracePeriod).toBe(5);
    expect(merged.capabilities).toEqual([Capability.Play, Capability.Pause]);
  });

  it('serializes for native', () => {
    const map = optionsToNativeMap(DEFAULT_PLAYER_OPTIONS);
    expect(map.capabilities).toEqual(expect.arrayContaining(['play', 'pause']));
    expect(map.appKilledPlaybackBehavior).toBe('continue-playback');
  });
});
