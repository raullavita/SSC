# SSC Android — keep libsignal classes when dependency is enabled.
-keep class org.signal.** { *; }

# Kotlin serialization for auth API models.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class com.supersecurechat.app.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-if class com.supersecurechat.app.data.model.**
-keepclassmembers class <1> {
    static **$Companion Companion;
    kotlinx.serialization.KSerializer serializer(...);
}