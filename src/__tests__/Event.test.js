const { Event, HEADLESS_TASK_NAME, REMOTE_EVENT_NAMES } = require('../Event');

describe('Event', () => {
  it('exports frozen kebab-case remote wire names', () => {
    expect(Event).toEqual({
      RemotePlay: 'remote-play',
      RemotePause: 'remote-pause',
      RemotePlayPause: 'remote-play-pause',
      RemoteStop: 'remote-stop',
      RemoteNext: 'remote-next',
      RemotePrevious: 'remote-previous',
      RemoteDuck: 'remote-duck',
    });
  });

  it('lists all remote events for native parity', () => {
    expect(REMOTE_EVENT_NAMES).toEqual([
      'remote-play',
      'remote-pause',
      'remote-play-pause',
      'remote-stop',
      'remote-next',
      'remote-previous',
      'remote-duck',
    ]);
    expect(new Set(REMOTE_EVENT_NAMES).size).toBe(REMOTE_EVENT_NAMES.length);
  });

  it('uses DailyReactNativePlayer as headless task key', () => {
    expect(HEADLESS_TASK_NAME).toBe('DailyReactNativePlayer');
    // Must match android/.../HeadlessPlaybackBootstrap.TASK_KEY
  });

  it('parity list matches Event values', () => {
    expect(REMOTE_EVENT_NAMES).toEqual(Object.values(Event));
  });
});
