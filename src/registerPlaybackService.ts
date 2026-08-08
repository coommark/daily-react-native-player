import { AppRegistry, Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import { Event, HEADLESS_TASK_NAME, type EventType, type RemoteDuckEvent } from './Event';

/** Async/sync body installed by the host (subscribes to remotes). */
export type ServiceHandler = () => void | Promise<void>;

/** Returns the service handler — same shape as `AppRegistry.registerHeadlessTask`. */
export type PlaybackServiceFactory = () => ServiceHandler;

export type EventSubscription = {
  remove(): void;
};

type EmptyRemoteListener = () => void;
type DuckRemoteListener = (event: RemoteDuckEvent) => void;

let registered = false;

/**
 * Subscribe to a native remote / policy event.
 * Prefer calling from `registerPlaybackService` so Android headless keeps JS alive.
 */
export function addEventListener(
  event: typeof Event.RemoteDuck,
  listener: DuckRemoteListener
): EventSubscription;
export function addEventListener(
  event: Exclude<EventType, typeof Event.RemoteDuck>,
  listener: EmptyRemoteListener
): EventSubscription;
export function addEventListener(
  event: EventType,
  listener: EmptyRemoteListener | DuckRemoteListener
): EventSubscription {
  if (Platform.OS === 'web') {
    return { remove() {} };
  }
  if (event === Event.RemoteDuck) {
    const subscription = NativeModule.addListener(Event.RemoteDuck, (payload: RemoteDuckEvent) => {
      (listener as DuckRemoteListener)({
        paused: !!(payload && payload.paused),
        permanent: !!(payload && payload.permanent),
      });
    });
    return {
      remove() {
        subscription.remove();
      },
    };
  }

  const subscription = NativeModule.addListener(event, () => {
    (listener as EmptyRemoteListener)();
  });
  return {
    remove() {
      subscription.remove();
    },
  };
}

/**
 * Register the JS playback service that owns remote policy (Bible: verse next/prev, etc.).
 *
 * Call once at app entry — before `registerRootComponent` / `AppRegistry.registerComponent`.
 * Do not call from `useEffect`.
 *
 * @example
 * ```ts
 * registerPlaybackService(() => playbackService);
 * ```
 *
 * Android: `AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, factory)`.
 * iOS: runs `factory()` then the handler via `setImmediate`.
 * Web: no-op.
 */
export function registerPlaybackService(factory: PlaybackServiceFactory): void {
  if (Platform.OS === 'web') {
    return;
  }
  if (registered) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[daily-react-native-player] registerPlaybackService called more than once; ignoring'
      );
    }
    return;
  }
  registered = true;

  if (Platform.OS === 'android') {
    // RN TaskProvider must return (data) => Promise<void>; wrap host handler.
    AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => {
      const handler = factory();
      return async () => {
        await Promise.resolve(handler());
      };
    });
    return;
  }

  // iOS / other: factory() → handler; setImmediate invokes the handler.
  setImmediate(() => {
    Promise.resolve(factory()()).catch(() => {
      // Host handlers should catch; ignore unhandled rejection here.
    });
  });
}

/** @internal test helper */
export function __resetPlaybackServiceRegistrationForTests(): void {
  registered = false;
}
