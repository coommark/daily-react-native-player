/**
 * Queue item type. `hls` reserved until T9. `silence` = native exact-duration gap (T7).
 */
export type TrackType = 'default' | 'hls' | 'silence';

export type Track = {
  /** Stable identity; assigned on add if omitted; always present in getQueue / events. */
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  type?: TrackType;
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
};
