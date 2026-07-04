package com.supersecurechat.app

import android.app.Activity
import android.os.Bundle

/**
 * SSC Android scaffold — Engine 10.
 * libsignal-android integration ships in the platform release phase (no APK build here).
 */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // WebView or native UI loads production web shell with X-SSC-Client header.
    }
}