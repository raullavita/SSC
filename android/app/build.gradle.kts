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
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
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
    }
}

dependencies {
    // Official Signal Android lib — wire in installed-client build (no APK packaging in Engine 10).
    // implementation("org.signal:libsignal-android:0.46.0")
    implementation("androidx.core:core-ktx:1.15.0")
}