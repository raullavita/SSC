package com.supersecurechat.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.supersecurechat.app.oauth.GoogleAuthHelper
import com.supersecurechat.app.ui.navigation.SscNavGraph
import com.supersecurechat.app.ui.theme.SscTheme

class MainActivity : ComponentActivity() {
    private var pendingOAuthCode by mutableStateOf<String?>(null)
    private var pendingOAuthError by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        consumeOAuthIntent(intent)

        val app = application as SscApplication

        setContent {
            SscTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SscNavGraph(
                        app = app,
                        pendingOAuthCode = pendingOAuthCode,
                        pendingOAuthError = pendingOAuthError,
                        onGoogleSignIn = { GoogleAuthHelper.launchGoogleSignIn(this) },
                        onOAuthHandled = {
                            pendingOAuthCode = null
                            pendingOAuthError = null
                        },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        consumeOAuthIntent(intent)
    }

    private fun consumeOAuthIntent(intent: Intent?) {
        GoogleAuthHelper.parseOAuthError(intent)?.let { error ->
            pendingOAuthError = error
            return
        }
        GoogleAuthHelper.parseOAuthCode(intent)?.let { code ->
            pendingOAuthCode = code
        }
    }
}