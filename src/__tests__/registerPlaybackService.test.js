const mockRegisterHeadlessTask = jest.fn();

jest.mock('../DailyReactNativePlayerModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('registerPlaybackService Android', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRegisterHeadlessTask.mockClear();
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native');
      return {
        ...actual,
        Platform: { OS: 'android', select: actual.Platform.select },
        AppRegistry: {
          ...actual.AppRegistry,
          registerHeadlessTask: (...args) => mockRegisterHeadlessTask(...args),
        },
      };
    });
  });

  it('registers Android headless task with HEADLESS_TASK_NAME', () => {
    const {
      registerPlaybackService,
      __resetPlaybackServiceRegistrationForTests,
    } = require('../registerPlaybackService');
    const { HEADLESS_TASK_NAME } = require('../Event');
    __resetPlaybackServiceRegistrationForTests();
    const handler = jest.fn();
    const factory = () => handler;
    registerPlaybackService(factory);
    expect(mockRegisterHeadlessTask).toHaveBeenCalledTimes(1);
    expect(mockRegisterHeadlessTask.mock.calls[0][0]).toBe(HEADLESS_TASK_NAME);
    expect(mockRegisterHeadlessTask.mock.calls[0][0]).toBe('DailyReactNativePlayer');
    const taskProvider = mockRegisterHeadlessTask.mock.calls[0][1];
    const task = taskProvider();
    expect(typeof task).toBe('function');
  });

  it('is idempotent on second call', () => {
    const {
      registerPlaybackService,
      __resetPlaybackServiceRegistrationForTests,
    } = require('../registerPlaybackService');
    __resetPlaybackServiceRegistrationForTests();
    registerPlaybackService(() => async () => {});
    registerPlaybackService(() => async () => {});
    expect(mockRegisterHeadlessTask).toHaveBeenCalledTimes(1);
  });
});

describe('registerPlaybackService iOS', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs factory handler via setImmediate on iOS', async () => {
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native');
      return {
        ...actual,
        Platform: { OS: 'ios', select: actual.Platform.select },
        AppRegistry: {
          ...actual.AppRegistry,
          registerHeadlessTask: jest.fn(),
        },
      };
    });

    const {
      registerPlaybackService,
      __resetPlaybackServiceRegistrationForTests,
    } = require('../registerPlaybackService');
    __resetPlaybackServiceRegistrationForTests();
    const handler = jest.fn(async () => {});
    registerPlaybackService(() => handler);
    expect(handler).not.toHaveBeenCalled();
    jest.runAllTimers();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('registerPlaybackService web', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('is a no-op on web', () => {
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native');
      return {
        ...actual,
        Platform: { OS: 'web', select: actual.Platform.select },
        AppRegistry: {
          ...actual.AppRegistry,
          registerHeadlessTask: mockRegisterHeadlessTask,
        },
      };
    });

    mockRegisterHeadlessTask.mockClear();
    const {
      registerPlaybackService,
      __resetPlaybackServiceRegistrationForTests,
    } = require('../registerPlaybackService');
    __resetPlaybackServiceRegistrationForTests();
    expect(() => registerPlaybackService(() => async () => {})).not.toThrow();
    expect(mockRegisterHeadlessTask).not.toHaveBeenCalled();
  });
});

describe('addEventListener', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native');
      return {
        ...actual,
        Platform: { OS: 'ios', select: actual.Platform.select },
      };
    });
  });

  it('forwards to native addListener and normalizes duck payload', () => {
    const remove = jest.fn();
    const addListener = jest.fn((_event, cb) => {
      cb({ paused: true, permanent: false });
      return { remove };
    });
    jest.doMock('../DailyReactNativePlayerModule', () => ({
      __esModule: true,
      default: { addListener },
    }));

    const { addEventListener } = require('../registerPlaybackService');
    const { Event } = require('../Event');
    const listener = jest.fn();
    const sub = addEventListener(Event.RemoteDuck, listener);
    expect(addListener).toHaveBeenCalledWith(Event.RemoteDuck, expect.any(Function));
    expect(listener).toHaveBeenCalledWith({ paused: true, permanent: false });
    sub.remove();
    expect(remove).toHaveBeenCalled();
  });
});
