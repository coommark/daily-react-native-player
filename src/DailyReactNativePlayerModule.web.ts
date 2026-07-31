import { registerWebModule, NativeModule } from 'expo';

import { DailyReactNativePlayerModuleEvents } from './DailyReactNativePlayer.types';

// DailyReactNativePlayerModule is not available on the web platform.
class DailyReactNativePlayerModule extends NativeModule<DailyReactNativePlayerModuleEvents> {}

export default registerWebModule(DailyReactNativePlayerModule, 'DailyReactNativePlayerModule');
