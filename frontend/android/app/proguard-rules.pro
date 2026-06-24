# Capacitor + custom SSC plugins
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class chat.ssc.secure.plugins.** { *; }

# libsignal JNI
-keep class org.signal.** { *; }
-dontwarn org.signal.**

# ML Kit on-device translation
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Google Play services / Firebase
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**