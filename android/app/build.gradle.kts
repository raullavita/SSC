plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.supersecurechat.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.supersecurechat.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "0.4.0"
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
        buildConfigField("String", "SSC_API_URL", "\"https://api.supersecurechat.com\"")
        buildConfigField("String", "SSC_CLIENT_IDENTITY", "\"android/0.4.0/15\"")
        val attestSecret = (
            project.findProperty("sscPlayIntegritySecret") as String?
                ?: System.getenv("SSC_PLAY_INTEGRITY_SECRET")
                ?: ""
            ).replace("\"", "\\\"")
        buildConfigField("String", "SSC_PLAY_INTEGRITY_SECRET", "\"$attestSecret\"")
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("SSC_ANDROID_KEYSTORE")
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("SSC_ANDROID_KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("SSC_ANDROID_KEY_ALIAS") ?: ""
                keyPassword = System.getenv("SSC_ANDROID_KEY_PASSWORD") ?: ""
            } else {
                val debugKeystore = File(System.getProperty("user.home"), ".android/debug.keystore")
                storeFile = debugKeystore
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // Keep same applicationId as release so google-services.json matches.
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        jniLibs {
            excludes += setOf(
                "**/libsignal_jni_testing.so",
                "**/signal_jni_testing.so",
            )
        }
        resources {
            excludes += setOf(
                "libsignal_jni*.dylib",
                "signal_jni*.dll",
                "libsignal_jni_testing.so",
            )
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation("org.signal:libsignal-android:0.96.4")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.sqlite:sqlite-ktx:2.4.0")
    // WebRTC for 1:1 audio calls
    implementation("io.getstream:stream-webrtc-android:1.1.3")

    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("com.google.mlkit:translate:17.0.3")
    implementation(platform("com.google.firebase:firebase-bom:33.9.0"))
    implementation("com.google.firebase:firebase-messaging")
}
