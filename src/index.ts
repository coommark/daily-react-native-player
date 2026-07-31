// Reexport the native module. On web, it will be resolved to DailyReactNativePlayerModule.web.ts
// and on native platforms to DailyReactNativePlayerModule.ts
export { default } from './DailyReactNativePlayerModule';
export * from './DailyReactNativePlayer.types';
