import { NativeModule, registerWebModule } from 'expo';

import { PlayerErrorCode, PlayerException } from './errors';

type ProgressPayload = {
  position: number;
  duration: number;
  buffered: number;
};

class DailyReactNativePlayerModule extends NativeModule {
  async setupPlayer(_options?: Record<string, unknown>): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async add(_url: string): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async play(): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async pause(): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async seekTo(_position: number): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async getProgress(): Promise<ProgressPayload> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async getPlaybackState(): Promise<string> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async getPlayWhenReady(): Promise<boolean> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async setPlayWhenReady(_value: boolean): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }

  async reset(): Promise<void> {
    throw new PlayerException(
      PlayerErrorCode.PlatformUnsupported,
      'daily-react-native-player is not supported on web'
    );
  }
}

export default registerWebModule(DailyReactNativePlayerModule, 'DailyReactNativePlayer');
