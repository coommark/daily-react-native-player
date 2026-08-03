import { NativeModule, requireNativeModule } from 'expo';

type ProgressPayload = {
  position: number;
  duration: number;
  buffered: number;
};

declare class DailyReactNativePlayerModule extends NativeModule {
  setupPlayer(options?: Record<string, unknown>): Promise<void>;
  add(url: string): Promise<void>;
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
