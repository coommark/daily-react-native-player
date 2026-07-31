/**
 * Contract skeleton — grows with docs/bible-acceptance.md.
 * Plain JS so Jest needs no Expo/babel preset at scaffold stage.
 */

const PLANNED_PUBLIC_SURFACE = [
  'setupPlayer',
  'updateOptions',
  'reset',
  'registerPlaybackService',
  'add',
  'remove',
  'getQueue',
  'getActiveTrack',
  'getActiveTrackIndex',
  'play',
  'pause',
  'skip',
  'skipToNext',
  'skipToPrevious',
  'seekTo',
  'setPlayWhenReady',
  'getPlayWhenReady',
  'getPlaybackState',
  'getProgress',
  'setRate',
  'updateNowPlayingMetadata',
  'updateMetadataForTrack',
  'addEventListener',
  'createSilenceTrack',
  'ambientSetPlaylist',
  'ambientPlay',
  'ambientPause',
  'ambientStop',
  'ambientSetVolume',
  'ambientFade',
];

describe('daily-react-native-player contract (scaffold)', () => {
  it('tracks the planned Bible acceptance surface', () => {
    expect(PLANNED_PUBLIC_SURFACE.length).toBeGreaterThan(10);
    expect(new Set(PLANNED_PUBLIC_SURFACE).size).toBe(PLANNED_PUBLIC_SURFACE.length);
  });

  it('includes P0 lifecycle and ambient opt-in names', () => {
    expect(PLANNED_PUBLIC_SURFACE).toEqual(
      expect.arrayContaining([
        'setupPlayer',
        'registerPlaybackService',
        'updateNowPlayingMetadata',
        'createSilenceTrack',
        'ambientSetPlaylist',
      ])
    );
  });
});
