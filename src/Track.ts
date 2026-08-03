/**
 * Progressive track shape (T3). Queue semantics arrive in T6.
 * `type: 'hls'` is reserved and rejected until T9.
 */
export type TrackType = 'default' | 'hls';

export type Track = {
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
