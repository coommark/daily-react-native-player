import {
  Event,
  addEventListener,
  getPlayWhenReady,
  pause,
  play,
} from 'daily-react-native-player';

/**
 * JS playback service — owns remote policy (lock screen / notification / headset).
 * Registered from example/index.ts before registerRootComponent.
 *
 * In a debug build, watch the Metro terminal for `[playbackService]` lines when
 * you tap lock-screen / notification controls.
 */
export async function playbackService(): Promise<void> {
  if (__DEV__) {
    console.log('[playbackService] registered — waiting for Remote* events');
  }

  addEventListener(Event.RemotePlay, () => {
    void safe('RemotePlay', () => play());
  });
  addEventListener(Event.RemotePause, () => {
    void safe('RemotePause', () => pause());
  });
  addEventListener(Event.RemoteStop, () => {
    void safe('RemoteStop', () => pause());
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
    void safe('RemoteNext', async () => {
      // no-op until T6 skip*
    });
  });
  addEventListener(Event.RemotePrevious, () => {
    void safe('RemotePrevious', async () => {
      // no-op until T6 skip*
    });
  });
  addEventListener(Event.RemoteDuck, (event) => {
    if (__DEV__) {
      console.log('[playbackService] RemoteDuck', event);
    }
  });
}

async function safe(label: string, fn: () => void | Promise<void>): Promise<void> {
  if (__DEV__) {
    console.log(`[playbackService] ${label}`);
  }
  try {
    await fn();
  } catch (e) {
    console.warn(`[playbackService] ${label} failed`, e);
  }
}
