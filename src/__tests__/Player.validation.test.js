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

const NativeModule = require('../DailyReactNativePlayerModule').default;
const { add, seekTo, reset, play, setupPlayer } = require('../Player');
const { PlayerErrorCode } = require('../errors');

describe('Player validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('rejects HLS type', async () => {
    await expect(add({ url: 'https://example.com/a.m3u8', type: 'hls' })).rejects.toEqual(
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
  });

  it('forwards setup and play to native', async () => {
    await setupPlayer();
    await add({ url: 'https://example.com/a.mp3' });
    await play();
    expect(NativeModule.setupPlayer).toHaveBeenCalled();
    expect(NativeModule.add).toHaveBeenCalledWith('https://example.com/a.mp3');
    expect(NativeModule.play).toHaveBeenCalled();
  });
});
