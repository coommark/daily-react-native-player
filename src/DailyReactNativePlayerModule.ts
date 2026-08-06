import { NativeModule, requireNativeModule } from 'expo';

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

declare class DailyReactNativePlayerModule extends NativeModule {
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
