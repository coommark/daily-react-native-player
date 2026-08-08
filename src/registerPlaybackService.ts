import { AppRegistry, Platform } from 'react-native';

import NativeModule from './DailyReactNativePlayerModule';
import {
  Event,
  HEADLESS_TASK_NAME,
  type EventType,
  type PlaybackActiveTrackChangedEvent,
  type PlaybackErrorEvent,
  type PlaybackPlayWhenReadyChangedEvent,
  type PlaybackProgressUpdatedEvent,
  type PlaybackQueueEndedEvent,
  type PlaybackStateEvent,
  type RemoteDuckEvent,
} from './Event';

/** Async/sync body installed by the host (subscribes to remotes). */
export type ServiceHandler = () => void | Promise<void>;

/** Returns the service handler — same shape as `AppRegistry.registerHeadlessTask`. */
export type PlaybackServiceFactory = () => ServiceHandler;

export type EventSubscription = {
  remove(): void;
};

type EmptyRemoteListener = () => void;
type DuckRemoteListener = (event: RemoteDuckEvent) => void;
type ActiveTrackListener = (event: PlaybackActiveTrackChangedEvent) => void;
type StateListener = (event: PlaybackStateEvent) => void;
type QueueEndedListener = (event: PlaybackQueueEndedEvent) => void;
type ErrorListener = (event: PlaybackErrorEvent) => void;
type ProgressListener = (event: PlaybackProgressUpdatedEvent) => void;
type PlayWhenReadyListener = (event: PlaybackPlayWhenReadyChangedEvent) => void;

let registered = false;

export function addEventListener(
  event: typeof Event.RemoteDuck,
  listener: DuckRemoteListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackActiveTrackChanged,
  listener: ActiveTrackListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackState,
  listener: StateListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackQueueEnded,
  listener: QueueEndedListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackError,
  listener: ErrorListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackProgressUpdated,
  listener: ProgressListener
): EventSubscription;
export function addEventListener(
  event: typeof Event.PlaybackPlayWhenReadyChanged,
  listener: PlayWhenReadyListener
): EventSubscription;
export function addEventListener(
  event:
    | typeof Event.RemotePlay
    | typeof Event.RemotePause
    | typeof Event.RemotePlayPause
    | typeof Event.RemoteStop
    | typeof Event.RemoteNext
    | typeof Event.RemotePrevious,
  listener: EmptyRemoteListener
): EventSubscription;
export function addEventListener(
  event: EventType,
  listener: (...args: any[]) => void
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

  if (
    event === Event.RemotePlay ||
    event === Event.RemotePause ||
    event === Event.RemotePlayPause ||
    event === Event.RemoteStop ||
    event === Event.RemoteNext ||
    event === Event.RemotePrevious
  ) {
    const subscription = NativeModule.addListener(event, () => {
      (listener as EmptyRemoteListener)();
    });
    return {
      remove() {
        subscription.remove();
      },
    };
  }

  const subscription = NativeModule.addListener(event as any, (payload: any) => {
    listener(payload);
  });
  return {
    remove() {
      subscription.remove();
    },
  };
}

/**
 * Register the JS playback service that owns remote policy.
 * Call once at app entry — before `registerRootComponent`.
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
    AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => {
      const handler = factory();
      return async () => {
        await Promise.resolve(handler());
      };
    });
    return;
  }

  setImmediate(() => {
    Promise.resolve(factory()()).catch(() => {});
  });
}

/** @internal test helper */
export function __resetPlaybackServiceRegistrationForTests(): void {
  registered = false;
}
