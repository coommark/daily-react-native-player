jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(async () => {}),
    updateOptions: jest.fn(async () => {}),
    add: jest.fn(async () => [0]),
    getActiveTrackIndex: jest.fn(async () => null),
    play: jest.fn(async () => {}),
    ambientSetPlaylist: jest.fn(async () => {}),
    ambientPlay: jest.fn(async () => {}),
    ambientPause: jest.fn(async () => {}),
    ambientStop: jest.fn(async () => {}),
    ambientSetVolume: jest.fn(async () => {}),
    ambientFade: jest.fn(async () => {}),
  },
}));

const { ambientSetPlaylist, ambientPlay, ambientSetVolume, ambientFade } = require('../Ambient');
const NativeModule = require('../DailyReactNativePlayerModule').default;
const { setupPlayer, add, play, __resetPlayerJsStateForTests } = require('../Player');
const { PlayerErrorCode } = require('../errors');

describe('Ambient validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPlayerJsStateForTests();
  });

  it('rejects bad volume and fade args', async () => {
    await expect(ambientSetVolume(1.5)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(ambientFade(-0.1, 100)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
    await expect(ambientFade(0.5, -1)).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('rejects empty playlist urls', async () => {
    await expect(ambientSetPlaylist([''])).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.InvalidArgument })
    );
  });

  it('forwards playlist and fade', async () => {
    await ambientSetPlaylist(['https://example.com/bed.mp3'], true);
    await ambientSetVolume(0);
    await ambientPlay();
    await ambientFade(0.35, 1500);
    expect(NativeModule.ambientSetPlaylist).toHaveBeenCalledWith(
      ['https://example.com/bed.mp3'],
      true
    );
    expect(NativeModule.ambientSetVolume).toHaveBeenCalledWith(0);
    expect(NativeModule.ambientPlay).toHaveBeenCalled();
    expect(NativeModule.ambientFade).toHaveBeenCalledWith(0.35, 1500);
  });

  it('speech-only path never calls ambient native methods', async () => {
    await setupPlayer();
    await add({ url: 'https://example.com/a.mp3' });
    await play();
    expect(NativeModule.ambientSetPlaylist).not.toHaveBeenCalled();
    expect(NativeModule.ambientPlay).not.toHaveBeenCalled();
    expect(NativeModule.ambientFade).not.toHaveBeenCalled();
  });
});
