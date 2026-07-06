plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.supersecurechat.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.supersecurechat.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 8
        versionName = "0.3.0"
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
        buildConfigField("String", "SSC_WEB_URL", "\"file:///android_asset/www/index.html\"")
        buildConfigField("String", "SSC_API_URL", "\"https://api.supersecurechat.com\"")
    }

    buildFeatures {
        buildConfig = true
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
                // App Distribution / local testing — debug keystore (signed APK required to install).
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
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("com.google.mlkit:translate:17.0.3")
}