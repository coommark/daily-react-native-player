/**
 * Progressive track shape. Queue semantics = T6.
 * `type: 'hls'` is reserved and rejected until T9.
 */
export type TrackType = 'default' | 'hls';

export type Track = {
  /** Stable identity; assigned on add if omitted; always present in getQueue / events. */
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  type?: TrackType;
};

export type Progress = {
  position: number;
  duration: number;
  buffered: number;
};
