/**
 * Cross-platform playback state vocabulary (T3).
 * Mapped from ExoPlayer / AVPlayer on native.
 *
 * `Buffering` / `Stopped` are host vocabulary aliases (same wire values as
 * `loading` / `none`). Native still emits only the seven core states.
 */
export const State = {
  None: 'none',
  Loading: 'loading',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Ended: 'ended',
  Error: 'error',
  /** Alias of {@link State.Loading} — rebuffer / cold buffer. */
  Buffering: 'loading',
  /** Alias of {@link State.None} — stopped / cleared queue. */
  Stopped: 'none',
} as const;

/** Core states emitted by native (excludes alias keys). */
export type PlaybackState =
  | typeof State.None
  | typeof State.Loading
  | typeof State.Ready
  | typeof State.Playing
  | typeof State.Paused
  | typeof State.Ended
  | typeof State.Error;
