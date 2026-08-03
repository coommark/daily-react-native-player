# Keep MediaSessionService entry points for host R8 / Play release builds.
-keep class expo.modules.dailyreactnativeplayer.PlaybackService { *; }
-keep class expo.modules.dailyreactnativeplayer.SpeechEngine { *; }
-keep class androidx.media3.session.MediaSessionService { *; }
-keep class androidx.media3.session.MediaSession { *; }
-keep class androidx.media3.session.MediaSession$Builder { *; }
-keep class androidx.media3.session.MediaSession$ControllerInfo { *; }
