/**
 * Contract tests — planned Bible surface + implemented T3 exports.
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

const IMPLEMENTED_T3 = [
  'setupPlayer',
  'add',
  'play',
  'pause',
  'seekTo',
  'getProgress',
  'getPlaybackState',
  'getPlayWhenReady',
  'setPlayWhenReady',
  'reset',
  'State',
  'PlayerErrorCode',
  'PlayerException',
];

jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(async () => {}),
    add: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    seekTo: jest.fn(async () => {}),
    getProgress: jest.fn(async () => ({ position: 0, duration: 0, buffered: 0 })),
    getPlaybackState: jest.fn(async () => 'none'),
    getPlayWhenReady: jest.fn(async () => false),
    setPlayWhenReady: jest.fn(async () => {}),
    reset: jest.fn(async () => {}),
  },
}));

describe('daily-react-native-player contract', () => {
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

  it('exports implemented T3 API', () => {
    const api = require('../index');
    for (const name of IMPLEMENTED_T3) {
      expect(api[name]).toBeDefined();
    }
    expect(typeof api.setupPlayer).toBe('function');
    expect(typeof api.add).toBe('function');
    expect(typeof api.play).toBe('function');
    expect(typeof api.pause).toBe('function');
    expect(typeof api.seekTo).toBe('function');
    expect(typeof api.getProgress).toBe('function');
    expect(typeof api.getPlaybackState).toBe('function');
    expect(typeof api.getPlayWhenReady).toBe('function');
    expect(typeof api.setPlayWhenReady).toBe('function');
    expect(typeof api.reset).toBe('function');
    expect(api.State.Playing).toBe('playing');
    expect(api.PlayerErrorCode.NoSource).toBe('no_source');
  });
});
