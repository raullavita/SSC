package com.supersecurechat.app

import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * WebViewClient for the SSC Android WebView shell.
 * Sends client-version header [CLIENT_HEADER] on each request and
 * intercepts OAuth start URLs to open them in Chrome Custom Tabs.
 */
class ApiClient : WebViewClient() {
    companion object {
        /** Installed-client identification header value — android/0.3.1/10. */
        const val CLIENT_HEADER = "android/0.3.1/10"
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val isForMainFrame = request.isForMainFrame
        val url = request.url.toString()
        if (isForMainFrame && SscOAuthLauncher.isOAuthStart(url)) {
            SscOAuthLauncher.launch(view.context, url)
            return true
        }
        return false
    }
}
