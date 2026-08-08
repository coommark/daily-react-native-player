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

  async add(
    _tracks: Record<string, unknown>[],
    _insertBeforeIndex?: number | null
  ): Promise<number[]> {
    unsupported();
  }

  async remove(_indexes: number[]): Promise<void> {
    unsupported();
  }

  async getQueue(): Promise<Record<string, unknown>[]> {
    unsupported();
  }

  async getActiveTrack(): Promise<Record<string, unknown> | null> {
    unsupported();
  }

  async getActiveTrackIndex(): Promise<number | null> {
    unsupported();
  }

  async skip(_index: number): Promise<void> {
    unsupported();
  }

  async skipToNext(): Promise<void> {
    unsupported();
  }

  async skipToPrevious(): Promise<void> {
    unsupported();
  }

  async updateMetadataForTrack(_index: number, _metadata: Record<string, unknown>): Promise<void> {
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

  async setRate(_rate: number): Promise<void> {
    unsupported();
  }

  async reset(): Promise<void> {
    unsupported();
  }

  async ambientSetPlaylist(_urls: string[], _loopAll?: boolean | null): Promise<void> {
    unsupported();
  }

  async ambientPlay(): Promise<void> {
    unsupported();
  }

  async ambientPause(): Promise<void> {
    unsupported();
  }

  async ambientStop(): Promise<void> {
    unsupported();
  }

  async ambientSetVolume(_level: number): Promise<void> {
    unsupported();
  }

  async ambientFade(_target: number, _durationMs: number): Promise<void> {
    unsupported();
  }
}

export default registerWebModule(DailyReactNativePlayerModule, 'DailyReactNativePlayer');
