package com.supersecurechat.app.ui.auth

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/**
 * Cloudflare Turnstile via a minimal WebView (managed widget).
 * Returns token to [onToken]; empty string on expire/error.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TurnstileWebView(
    siteKey: String,
    onToken: (String) -> Unit,
    modifier: Modifier = Modifier,
    resetKey: Int = 0,
) {
    val jsBridge = remember {
        object {
            @JavascriptInterface
            fun onToken(token: String) {
                onToken(token)
            }

            @JavascriptInterface
            fun onExpire() {
                onToken("")
            }

            @JavascriptInterface
            fun onError() {
                onToken("")
            }
        }
    }

    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp),
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                addJavascriptInterface(jsBridge, "SscTurnstile")
                webViewClient = WebViewClient()
                loadDataWithBaseURL(
                    "https://challenges.cloudflare.com",
                    turnstileHtml(siteKey),
                    "text/html",
                    "UTF-8",
                    null,
                )
            }
        },
        update = { webView ->
            // reload when resetKey changes
            webView.tag = resetKey
            webView.loadDataWithBaseURL(
                "https://challenges.cloudflare.com",
                turnstileHtml(siteKey),
                "text/html",
                "UTF-8",
                null,
            )
        },
    )

    DisposableEffect(Unit) {
        onDispose { }
    }
}

private fun turnstileHtml(siteKey: String): String {
    val key = siteKey.replace("\"", "")
    return """
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>body{margin:0;display:flex;justify-content:center;background:transparent}</style>
</head>
<body>
<div id="cf-turnstile"></div>
<script>
function ready() {
  if (!window.turnstile) { setTimeout(ready, 50); return; }
  turnstile.render('#cf-turnstile', {
    sitekey: "$key",
    callback: function(token) { SscTurnstile.onToken(token); },
    'expired-callback': function() { SscTurnstile.onExpire(); },
    'error-callback': function() { SscTurnstile.onError(); }
  });
}
ready();
</script>
</body>
</html>
""".trimIndent()
}
