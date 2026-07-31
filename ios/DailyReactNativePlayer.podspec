Pod::Spec.new do |s|
  s.name           = 'DailyReactNativePlayer'
  s.version        = '0.1.0'
  s.summary        = 'Expo-first background audio for React Native (New Architecture only)'
  s.description    = 'Background playback, lock-screen and notification remotes, speech queue, silence tracks, and optional ambient dual-audio. Built for Daily Bible.'
  s.author         = 'Mark Melton <coommark@gmail.com>'
  s.homepage       = 'https://github.com/coommark/daily-react-native-player'
  s.license        = 'MIT'
  s.swift_version  = '5.9'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/coommark/daily-react-native-player.git', tag: "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
