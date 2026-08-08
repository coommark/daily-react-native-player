/**
 * Queue item type. `hls` reserved until T9. `silence` = native exact-duration gap (T7).
 */
export const TrackType = {
  Default: 'default',
  HLS: 'hls',
  Silence: 'silence',
} as const;

export type TrackTypeValue = (typeof TrackType)[keyof typeof TrackType];

export type Track = {
  /** Stable identity; assigned on add if omitted; always present in getQueue / events. */
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  type?: TrackTypeValue;
  /**
   * Duration in seconds when known up front.
   * Required / authoritative for `type: 'silence'` (`durationMs / 1000`).
   */
  duration?: number;
};

export type Progress = {
  position: number;
  duration: number;
  buffered: number;
  /**
   * Active queue index when known.
   * Included on `playback-progress-updated` events; omitted from `getProgress()`.
   */
  track?: number | null;
};
