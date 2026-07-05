package com.supersecurechat.app

import android.app.Activity
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView

/**
 * SSC Android installed client — WebView shell + libsignal-android (Engine 14).
 * Step 11: grant WebRTC camera/mic permissions inside WebView.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var nativeBridge: SscNativeBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        nativeBridge = SscNativeBridge(this, webView, filesDir)
        webView.addJavascriptInterface(nativeBridge, "__sscBridge")

        val entryUrl = BuildConfig.SSC_WEB_URL
        webView.webViewClient = ApiClient.webViewClient(this, entryUrl, webView)
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