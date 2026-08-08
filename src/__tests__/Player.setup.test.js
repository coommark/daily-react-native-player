jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(async () => {}),
    updateOptions: jest.fn(async () => {}),
  },
}));

const NativeModule = require('../DailyReactNativePlayerModule').default;
const { setupPlayer, __resetPlayerJsStateForTests } = require('../Player');
const { PlayerErrorCode, isPlayerException } = require('../errors');

describe('Player setupPlayer coalesce + timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    __resetPlayerJsStateForTests();
    NativeModule.setupPlayer.mockImplementation(async () => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetPlayerJsStateForTests();
  });

  it('coalesces concurrent setupPlayer into one native call', async () => {
    let resolveNative;
    NativeModule.setupPlayer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNative = resolve;
        })
    );

    const p1 = setupPlayer({ progressUpdateEventInterval: 1 });
    const p2 = setupPlayer({ progressUpdateEventInterval: 2 });
    const p3 = setupPlayer();

    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(1);

    resolveNative();
    await Promise.all([p1, p2, p3]);
    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(1);
  });

  it('throws setup_timeout when native setup exceeds 10s', async () => {
    jest.useFakeTimers();
    NativeModule.setupPlayer.mockImplementation(() => new Promise(() => {}));

    const pending = setupPlayer();
    const assertion = expect(pending).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.SetupTimeout })
    );
    await jest.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it('allows retry after failed setup', async () => {
    NativeModule.setupPlayer
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'load_failed' }))
      .mockResolvedValueOnce(undefined);

    await expect(setupPlayer()).rejects.toEqual(
      expect.objectContaining({ code: PlayerErrorCode.LoadFailed })
    );
    await setupPlayer();
    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(2);
  });

  it('second setup after success does not throw', async () => {
    await setupPlayer();
    await setupPlayer();
    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(2);
  });

  it('__resetPlayerJsStateForTests clears in-flight coalesce', async () => {
    let resolveHang;
    NativeModule.setupPlayer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHang = resolve;
        })
    );
    const hang = setupPlayer();
    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(1);
    __resetPlayerJsStateForTests();
    NativeModule.setupPlayer.mockResolvedValue(undefined);
    await setupPlayer();
    expect(NativeModule.setupPlayer).toHaveBeenCalledTimes(2);
    resolveHang();
    await hang;
  });

  it('timeout error is a PlayerException', async () => {
    jest.useFakeTimers();
    NativeModule.setupPlayer.mockImplementation(() => new Promise(() => {}));
    const pending = setupPlayer();
    const catcher = pending.then(
      () => {
        throw new Error('expected reject');
      },
      (e) => e
    );
    await jest.advanceTimersByTimeAsync(10_000);
    const err = await catcher;
    expect(isPlayerException(err)).toBe(true);
    expect(err.code).toBe(PlayerErrorCode.SetupTimeout);
  });
});
