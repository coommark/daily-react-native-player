const {
  Event,
  HEADLESS_TASK_NAME,
  REMOTE_EVENT_NAMES,
  PLAYBACK_EVENT_NAMES,
  ALL_EVENT_NAMES,
} = require('../Event');

describe('Event', () => {
  it('exports remote and playback kebab-case wire names', () => {
    expect(Event.RemotePlay).toBe('remote-play');
    expect(Event.RemoteDuck).toBe('remote-duck');
    expect(Event.PlaybackActiveTrackChanged).toBe('playback-active-track-changed');
    expect(Event.PlaybackState).toBe('playback-state');
    expect(Event.PlaybackQueueEnded).toBe('playback-queue-ended');
    expect(Event.PlaybackError).toBe('playback-error');
    expect(Event.PlaybackProgressUpdated).toBe('playback-progress-updated');
    expect(Event.PlaybackPlayWhenReadyChanged).toBe('playback-play-when-ready-changed');
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

  it('lists playback events for native parity', () => {
    expect(PLAYBACK_EVENT_NAMES).toEqual([
      'playback-active-track-changed',
      'playback-state',
      'playback-queue-ended',
      'playback-error',
      'playback-progress-updated',
      'playback-play-when-ready-changed',
    ]);
  });

  it('ALL_EVENT_NAMES is remote + playback without duplicates', () => {
    expect(ALL_EVENT_NAMES).toEqual([...REMOTE_EVENT_NAMES, ...PLAYBACK_EVENT_NAMES]);
    expect(new Set(ALL_EVENT_NAMES).size).toBe(ALL_EVENT_NAMES.length);
  });

  it('uses DailyReactNativePlayer as headless task key', () => {
    expect(HEADLESS_TASK_NAME).toBe('DailyReactNativePlayer');
  });
});
