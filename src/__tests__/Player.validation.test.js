jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(async () => {}),
    updateOptions: jest.fn(async () => {}),
    add: jest.fn(async () => [0]),
    remove: jest.fn(async () => {}),
    getQueue: jest.fn(async () => []),
    getActiveTrack: jest.fn(async () => null),
    getActiveTrackIndex: jest.fn(async () => null),
    skip: jest.fn(async () => {}),
    skipToNext: jest.fn(async () => {}),
    skipToPrevious: jest.fn(async () => {}),
    updateMetadataForTrack: jest.fn(async () => {}),
    updateNowPlayingMetadata: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    seekTo: jest.fn(async () => {}),
    getProgress: jest.fn(async () => ({ position: 0, duration: 0, buffered: 0 })),
    getPlaybackState: jest.fn(async () => 'none'),
    getPlayWhenReady: jest.fn(async () => false),
    setPlayWhenReady: jest.fn(async () => {}),
    setRate: jest.fn(async () => {}),
    reset: jest.fn(async () => {}),
  },
}));

const NativeModule = require('../DailyReactNativePlayerModule').default;
const {
  AppKilledPlaybackBehavior,
  DEFAULT_PLAYER_OPTIONS,
  mergePlayerOptions,
} = require('../Options');
const {
  add,
  remove,
  skip,
  seekTo,
  reset,
  play,
  setupPlayer,
  updateOptions,
  updateNowPlayingMetadata,
  updateMetadataForTrack,
  getPlayerOptions,
  getQueue,
  setRate,
  __resetPlayerJsStateForTests,
} = require('../Player');
const { createSilenceTrack } = require('../createSilenceTrack');
const { PlayerErrorCode } = require('../errors');

describe('Player validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPlayerJsStateForTests();
    NativeModule.getActiveTrackIndex.mockResolvedValue(null);
    NativeModule.add.mockResolvedValue([0]);
  });

  it('rejects empty add', async () => {
    await expect(add([])).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects non-string url', async () => {
    await expect(add({ url: 123 })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('accepts HLS type and forwards to native', async () => {
    await add({ url: 'https://example.com/a.m3u8', type: 'hls', title: 'Chapter' });
    expect(NativeModule.add).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          url: 'https://example.com/a.m3u8',
          type: 'hls',
          title: 'Chapter',
        }),
      ],
      null
    );
  });

  it('tags .m3u8 urls as hls when type omitted', async () => {
    await add({ url: 'https://cdn.example.com/ch.m3u8?token=1' });
    expect(NativeModule.add).toHaveBeenCalledWith(
      [expect.objectContaining({ url: 'https://cdn.example.com/ch.m3u8?token=1', type: 'hls' })],
      null
    );
  });

  it('rejects unknown track types', async () => {
    await expect(add({ url: 'https://example.com/a.mp3', type: 'dash' })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.UnsupportedType })
    );
  });

  it('rejects content:// on iOS', async () => {
    await expect(add({ url: 'content://media/1' })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.UnsupportedUrl })
    );
  });

  it('rejects bad seek', async () => {
    await expect(seekTo(-1)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(seekTo(Number.NaN)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('reset before setup is allowed', async () => {
    await expect(reset()).resolves.toBeUndefined();
    expect(NativeModule.reset).toHaveBeenCalled();
    expect(NativeModule.updateOptions).toHaveBeenCalled();
  });

  it('rejects invalid setRate values', async () => {
    await expect(setRate(0)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(setRate(0.1)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(setRate(4.1)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(setRate(Number.NaN)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('forwards valid setRate to native', async () => {
    await setRate(1.25);
    expect(NativeModule.setRate).toHaveBeenCalledWith(1.25);
  });

  it('forwards setup and play to native', async () => {
    await setupPlayer();
    await add({ url: 'https://example.com/a.mp3' });
    await play();
    expect(NativeModule.setupPlayer).toHaveBeenCalled();
    expect(NativeModule.add).toHaveBeenCalledWith(
      [expect.objectContaining({ url: 'https://example.com/a.mp3' })],
      null
    );
    expect(NativeModule.play).toHaveBeenCalled();
  });

  it('forwards metadata fields on add when autoUpdateMetadata', async () => {
    await add({
      url: 'https://example.com/a.mp3',
      title: 'Chapter 1',
      artist: 'Narrator',
      album: 'Bible',
    });
    expect(NativeModule.add).toHaveBeenCalledWith(
      [
        {
          url: 'https://example.com/a.mp3',
          title: 'Chapter 1',
          artist: 'Narrator',
          album: 'Bible',
        },
      ],
      null
    );
  });

  it('batch add forwards array and insert index', async () => {
    NativeModule.getActiveTrackIndex.mockResolvedValue(0);
    NativeModule.add.mockResolvedValue([1, 2]);
    const indices = await add(
      [{ url: 'https://example.com/a.mp3' }, { url: 'https://example.com/b.mp3', id: 'b' }],
      1
    );
    expect(indices).toEqual([1, 2]);
    expect(NativeModule.add).toHaveBeenCalledWith(
      [
        expect.objectContaining({ url: 'https://example.com/a.mp3' }),
        expect.objectContaining({ url: 'https://example.com/b.mp3', id: 'b' }),
      ],
      1
    );
  });

  it('remove and skip forward to native', async () => {
    await remove([1, 2]);
    await skip(0);
    expect(NativeModule.remove).toHaveBeenCalledWith([1, 2]);
    expect(NativeModule.skip).toHaveBeenCalledWith(0);
  });

  it('updateOptions persists across reset and re-pushes to native', async () => {
    await updateOptions({
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
      stopForegroundGracePeriod: 9,
      progressUpdateEventInterval: 0,
    });
    NativeModule.updateOptions.mockClear();
    await reset();
    const opts = getPlayerOptions();
    expect(opts.appKilledPlaybackBehavior).toBe(AppKilledPlaybackBehavior.PausePlayback);
    expect(opts.stopForegroundGracePeriod).toBe(9);
    expect(opts.progressUpdateEventInterval).toBe(0);
    expect(NativeModule.reset).toHaveBeenCalled();
    expect(NativeModule.updateOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
        stopForegroundGracePeriod: 9,
        progressUpdateEventInterval: 0,
      })
    );
    const resetOrder = NativeModule.reset.mock.invocationCallOrder[0];
    const optionsOrder = NativeModule.updateOptions.mock.invocationCallOrder[0];
    expect(resetOrder).toBeLessThan(optionsOrder);
  });

  it('defaults progressUpdateEventInterval to 1', () => {
    expect(DEFAULT_PLAYER_OPTIONS.progressUpdateEventInterval).toBe(1);
    const merged = mergePlayerOptions(DEFAULT_PLAYER_OPTIONS, {});
    expect(merged.progressUpdateEventInterval).toBe(1);
  });

  it('updateNowPlayingMetadata calls native', async () => {
    await updateNowPlayingMetadata({ title: 'Forced' });
    expect(NativeModule.updateNowPlayingMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Forced' })
    );
  });

  it('updateMetadataForTrack forwards any non-negative index', async () => {
    await updateMetadataForTrack(1, { title: 'x' });
    expect(NativeModule.updateMetadataForTrack).toHaveBeenCalledWith(1, { title: 'x' });
  });

  it('getQueue normalizes native tracks', async () => {
    NativeModule.getQueue.mockResolvedValue([
      { id: '1', url: 'https://example.com/a.mp3', title: 'A' },
    ]);
    const q = await getQueue();
    expect(q).toEqual([{ id: '1', url: 'https://example.com/a.mp3', title: 'A' }]);
  });

  it('forwards createSilenceTrack payload to native', async () => {
    await add(createSilenceTrack({ durationMs: 1000, id: 'gap' }));
    expect(NativeModule.add).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'silence',
          url: 'silence:1000',
          durationMs: 1000,
          duration: 1,
          id: 'gap',
        }),
      ],
      null
    );
  });

  it('accepts already-canonical silence track', async () => {
    await add({ type: 'silence', url: 'silence:800', duration: 0.8 });
    expect(NativeModule.add).toHaveBeenCalledWith(
      [expect.objectContaining({ type: 'silence', url: 'silence:800', durationMs: 800 })],
      null
    );
  });

  it('rejects type silence with progressive url', async () => {
    await expect(add({ type: 'silence', url: 'https://example.com/a.wav' })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects silence url without silence type', async () => {
    await expect(add({ url: 'silence:800' })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects mismatched silence duration vs url', async () => {
    await expect(add({ type: 'silence', url: 'silence:800', duration: 1 })).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('getQueue normalizes silence tracks from native', async () => {
    NativeModule.getQueue.mockResolvedValue([
      { id: 's1', type: 'silence', url: 'silence:500', durationMs: 500 },
    ]);
    const q = await getQueue();
    expect(q).toEqual([{ id: 's1', type: 'silence', url: 'silence:500', duration: 0.5 }]);
  });
});
