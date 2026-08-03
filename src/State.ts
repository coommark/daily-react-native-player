/**
 * Cross-platform playback state vocabulary (T3).
 * Mapped from ExoPlayer / AVPlayer on native.
 */
export const State = {
  None: 'none',
  Loading: 'loading',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Ended: 'ended',
  Error: 'error',
} as const;

export type PlaybackState = (typeof State)[keyof typeof State];
