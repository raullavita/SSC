package com.supersecurechat.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView

/**
 * SSC Android installed client — WebView shell + libsignal-android (Engine 14).
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        val entryUrl = BuildConfig.SSC_WEB_URL
        webView.webViewClient = ApiClient.webViewClient(entryUrl)
        webView.loadUrl(entryUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}