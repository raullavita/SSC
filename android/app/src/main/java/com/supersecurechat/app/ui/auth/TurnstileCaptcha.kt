package com.supersecurechat.app.ui.auth

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TurnstileCaptcha(
    siteKey: String,
    onToken: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val html = """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        </head>
        <body style="margin:0;padding:0;background:transparent;">
          <div class="cf-turnstile" data-sitekey="$siteKey" data-callback="onTurnstile"></div>
          <script>
            function onTurnstile(token) {
              if (window.SscTurnstile) window.SscTurnstile.deliverCaptchaToken(token);
            }
          </script>
        </body>
        </html>
    """.trimIndent()

    AndroidView(
        modifier = modifier,
        factory = { context ->
            val deliverToken = onToken
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                webViewClient = WebViewClient()
                addJavascriptInterface(
                    object {
                        @JavascriptInterface
                        fun deliverCaptchaToken(token: String) {
                            deliverToken(token)
                        }
                    },
                    "SscTurnstile",
                )
                loadDataWithBaseURL(
                    "https://www.supersecurechat.com",
                    html,
                    "text/html",
                    "UTF-8",
                    null,
                )
            }
        },
    )
}