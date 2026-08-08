import { NativeModule, requireNativeModule } from 'expo';

import type { RemoteDuckEvent } from './Event';

type ProgressPayload = {
  position: number;
  duration: number;
  buffered: number;
};

type TrackPayload = {
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
};

declare class DailyReactNativePlayerModule extends NativeModule<PlayerEvents> {
  setupPlayer(options?: Record<string, unknown>): Promise<void>;
  updateOptions(options?: Record<string, unknown>): Promise<void>;
  add(track: TrackPayload): Promise<void>;
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
