import {
  Event,
  addEventListener,
  getPlayWhenReady,
  pause,
  play,
  reset,
  skipToNext,
  skipToPrevious,
} from 'daily-react-native-player';

/**
 * JS playback service — owns remote policy (lock screen / notification / headset).
 * Registered from example/index.ts before registerRootComponent.
 */
export async function playbackService(): Promise<void> {
  addEventListener(Event.RemotePlay, () => {
    void safe('RemotePlay', () => play());
  });
  addEventListener(Event.RemotePause, () => {
    void safe('RemotePause', () => pause());
  });
  // Recommended host Stop policy: clear play-intent then reset queue (see docs/contracts.md).
  addEventListener(Event.RemoteStop, () => {
    void safe('RemoteStop', async () => {
      await pause();
      await reset();
    });
  });
  addEventListener(Event.RemotePlayPause, () => {
    void safe('RemotePlayPause', async () => {
      const ready = await getPlayWhenReady();
      if (ready) {
        await pause();
      } else {
        await play();
      }
    });
  });
  addEventListener(Event.RemoteNext, () => {
    void safe('RemoteNext', () => skipToNext());
  });
  addEventListener(Event.RemotePrevious, () => {
    void safe('RemotePrevious', () => skipToPrevious());
  });
  addEventListener(Event.RemoteDuck, (event) => {
    if (__DEV__) {
      console.log('[playbackService] RemoteDuck', event);
    }
  });
}

async function safe(label: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn(`[playbackService] ${label} failed`, e);
  }
}
