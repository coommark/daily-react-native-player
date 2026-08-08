import { NativeModule, requireNativeModule } from 'expo';

import type {
  PlaybackActiveTrackChangedEvent,
  PlaybackErrorEvent,
  PlaybackPlayWhenReadyChangedEvent,
  PlaybackProgressUpdatedEvent,
  PlaybackQueueEndedEvent,
  PlaybackStateEvent,
  RemoteDuckEvent,
} from './Event';

type ProgressPayload = {
  position: number;
  duration: number;
  buffered: number;
};

type TrackPayload = {
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
};

type MetadataPayload = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
};

type PlayerEvents = {
  'remote-play': () => void;
  'remote-pause': () => void;
  'remote-play-pause': () => void;
  'remote-stop': () => void;
  'remote-next': () => void;
  'remote-previous': () => void;
  'remote-duck': (event: RemoteDuckEvent) => void;
  'playback-active-track-changed': (event: PlaybackActiveTrackChangedEvent) => void;
  'playback-state': (event: PlaybackStateEvent) => void;
  'playback-queue-ended': (event: PlaybackQueueEndedEvent) => void;
  'playback-error': (event: PlaybackErrorEvent) => void;
  'playback-progress-updated': (event: PlaybackProgressUpdatedEvent) => void;
  'playback-play-when-ready-changed': (event: PlaybackPlayWhenReadyChangedEvent) => void;
};

declare class DailyReactNativePlayerModule extends NativeModule<PlayerEvents> {
  setupPlayer(options?: Record<string, unknown>): Promise<void>;
  updateOptions(options?: Record<string, unknown>): Promise<void>;
  add(tracks: TrackPayload[], insertBeforeIndex?: number | null): Promise<number[]>;
  remove(indexes: number[]): Promise<void>;
  getQueue(): Promise<TrackPayload[]>;
  getActiveTrack(): Promise<TrackPayload | null | undefined>;
  getActiveTrackIndex(): Promise<number | null | undefined>;
  skip(index: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  updateMetadataForTrack(index: number, metadata: MetadataPayload): Promise<void>;
  updateNowPlayingMetadata(metadata: MetadataPayload): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(position: number): Promise<void>;
  getProgress(): Promise<ProgressPayload>;
  getPlaybackState(): Promise<string>;
  getPlayWhenReady(): Promise<boolean>;
  setPlayWhenReady(value: boolean): Promise<void>;
  reset(): Promise<void>;
}

export default requireNativeModule<DailyReactNativePlayerModule>('DailyReactNativePlayer');
