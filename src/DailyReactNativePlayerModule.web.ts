import { NativeModule, registerWebModule } from 'expo';

import { PlayerErrorCode, PlayerException } from './errors';

type ProgressPayload = {
  position: number;
  duration: number;
  buffered: number;
};

function unsupported(): never {
  throw new PlayerException(
    PlayerErrorCode.PlatformUnsupported,
    'daily-react-native-player is not supported on web'
  );
}

class DailyReactNativePlayerModule extends NativeModule {
  async setupPlayer(_options?: Record<string, unknown>): Promise<void> {
    unsupported();
  }

  async updateOptions(_options?: Record<string, unknown>): Promise<void> {
    unsupported();
  }

  async add(_track: Record<string, unknown>): Promise<void> {
    unsupported();
  }

  async updateNowPlayingMetadata(_metadata: Record<string, unknown>): Promise<void> {
    unsupported();
  }

  async play(): Promise<void> {
    unsupported();
  }

  async pause(): Promise<void> {
    unsupported();
  }

  async seekTo(_position: number): Promise<void> {
    unsupported();
  }

  async getProgress(): Promise<ProgressPayload> {
    unsupported();
  }

  async getPlaybackState(): Promise<string> {
    unsupported();
  }

  async getPlayWhenReady(): Promise<boolean> {
    unsupported();
  }

  async setPlayWhenReady(_value: boolean): Promise<void> {
    unsupported();
  }

  async reset(): Promise<void> {
    unsupported();
  }
}

export default registerWebModule(DailyReactNativePlayerModule, 'DailyReactNativePlayer');
