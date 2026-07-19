package com.supersecurechat.app

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.supersecurechat.app.ui.SscApp

/**
 * SSC Android — pure native Jetpack Compose.
 * WebView messenger UI is removed (NATIVE_CLIENT_CHARTER).
 */
class MainActivity : ComponentActivity() {
    private var launchIntent by mutableStateOf<Intent?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.parseColor("#0B141A")
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.parseColor("#0B141A")

        launchIntent = intent

        setContent {
            SscApp(pendingIntent = launchIntent)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        launchIntent = intent
    }
}
