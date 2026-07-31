import { NativeModule, requireNativeModule } from 'expo';

import { DailyReactNativePlayerModuleEvents } from './DailyReactNativePlayer.types';

declare class DailyReactNativePlayerModule extends NativeModule<DailyReactNativePlayerModuleEvents> {
  /** @deprecated Scaffold smoke only — replaced by Player API in T3+. */
  PI: number;
  /** @deprecated Scaffold smoke only — replaced by Player API in T3+. */
  hello(): string;
  /** @deprecated Scaffold smoke only — replaced by Player API in T3+. */
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<DailyReactNativePlayerModule>('DailyReactNativePlayer');
