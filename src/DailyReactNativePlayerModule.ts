import { NativeModule, requireNativeModule } from 'expo';

import { DailyReactNativePlayerModuleEvents } from './DailyReactNativePlayer.types';

declare class DailyReactNativePlayerModule extends NativeModule<DailyReactNativePlayerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<DailyReactNativePlayerModule>('DailyReactNativePlayer');
