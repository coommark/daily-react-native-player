/**
 * Contract tests — planned Bible surface + implemented T3/T4 exports.
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

const IMPLEMENTED_T4 = [
  'setupPlayer',
  'updateOptions',
  'add',
  'updateNowPlayingMetadata',
  'updateMetadataForTrack',
  'play',
  'pause',
  'seekTo',
  'getProgress',
  'getPlaybackState',
  'getPlayWhenReady',
  'setPlayWhenReady',
  'reset',
  'getPlayerOptions',
  'State',
  'Capability',
  'AppKilledPlaybackBehavior',
  'PlayerErrorCode',
  'PlayerException',
];

jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(async () => {}),
    updateOptions: jest.fn(async () => {}),
    add: jest.fn(async () => {}),
    updateNowPlayingMetadata: jest.fn(async () => {}),
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

  it('exports implemented T4 API', () => {
    const api = require('../index');
    for (const name of IMPLEMENTED_T4) {
      expect(api[name]).toBeDefined();
    }
    expect(typeof api.setupPlayer).toBe('function');
    expect(typeof api.updateOptions).toBe('function');
    expect(typeof api.updateNowPlayingMetadata).toBe('function');
    expect(typeof api.updateMetadataForTrack).toBe('function');
    expect(api.Capability.Play).toBe('play');
    expect(api.AppKilledPlaybackBehavior.ContinuePlayback).toBe('continue-playback');
    expect(api.State.Playing).toBe('playing');
    expect(api.PlayerErrorCode.NoSource).toBe('no_source');
    expect(api.PlayerErrorCode.SetupTimeout).toBe('setup_timeout');
  });
});
