const { State } = require('../State');
const { TrackType } = require('../Track');

describe('State', () => {
  it('exports core wire values', () => {
    expect(State.None).toBe('none');
    expect(State.Loading).toBe('loading');
    expect(State.Ready).toBe('ready');
    expect(State.Playing).toBe('playing');
    expect(State.Paused).toBe('paused');
    expect(State.Ended).toBe('ended');
    expect(State.Error).toBe('error');
  });

  it('aliases Buffering to loading and Stopped to none', () => {
    expect(State.Buffering).toBe(State.Loading);
    expect(State.Stopped).toBe(State.None);
  });
});

describe('TrackType', () => {
  it('exports const object for hosts', () => {
    expect(TrackType.Default).toBe('default');
    expect(TrackType.HLS).toBe('hls');
    expect(TrackType.Silence).toBe('silence');
  });
});
