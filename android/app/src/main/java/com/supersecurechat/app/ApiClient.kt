package com.supersecurechat.app

import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * WebViewClient that handles navigation inside the bundled web shell.
 *
 * - Intercepts OAuth start URLs and opens them via [SscOAuthLauncher] (Custom Tab).
 * - Reports the client identity to the server via the User-Agent / X-SSC-Client header.
 *
 * Client header: android/0.3.1/10
 */
class ApiClient(private val context: Context) : WebViewClient() {

    companion object {
        const val CLIENT_HEADER = "android/0.3.1/10"
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        val url = request.url.toString()
        if (SscOAuthLauncher.isOAuthStart(url)) {
            SscOAuthLauncher.launch(context, url)
            return true
        }
        return false
    }
}
