package com.supersecurechat.app

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.HttpURLConnection
import java.net.URL

/**
 * Injects X-SSC-Client on API requests and loads the native crypto bridge (Engine 11 / Step 5).
 * Step 17: shell feature flags + offline detection callbacks.
 */
object ApiClient {
    const val CLIENT_HEADER = "X-SSC-Client"
    const val CLIENT_VALUE = "android/0.3.0/7"
    const val SHELL_FEATURES = "splash_screen,deep_links,pull_to_refresh,offline_retry,file_chooser,edge_to_edge"

    fun attachInstalledClientHeaders(conn: HttpURLConnection) {
        conn.setRequestProperty(CLIENT_HEADER, CLIENT_VALUE)
    }

    fun webViewClient(
        activity: Activity,
        baseUrl: String,
        webView: WebView,
        onPageFinished: (() -> Unit)? = null,
        onLoadError: (() -> Unit)? = null,
        onLoadSuccess: (() -> Unit)? = null,
    ): WebViewClient =
        object : WebViewClient() {
            private var bridgeInjected = false

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return handleUrlLoading(view, url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                if (request == null) return false
                return handleUrlLoading(view, request.url?.toString())
            }

            private fun handleUrlLoading(view: WebView?, url: String?): Boolean {
                val target = url ?: return false
                if (SscOAuthLauncher.isOAuthStart(target) || SscOAuthLauncher.isGoogleAccounts(target)) {
                    SscOAuthLauncher.launchCustomTab(activity, target)
                    return true
                }
                if (SscOAuthLauncher.isOAuthFinish(target)) {
                    val webUrl = SscDeepLink.resolveUri(Uri.parse(target), baseUrl)
                    view?.loadUrl(webUrl)
                    return true
                }
                return false
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?,
            ): WebResourceResponse? {
                if (request?.isForMainFrame == true) {
                    return super.shouldInterceptRequest(view, request)
                }
                val url = request?.url?.toString() ?: return super.shouldInterceptRequest(view, request)
                if (!url.contains("/api/")) {
                    return super.shouldInterceptRequest(view, request)
                }
                return try {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        requestMethod = request.method
                        attachInstalledClientHeaders(this)
                        request.requestHeaders.forEach { (k, v) ->
                            if (!k.equals(CLIENT_HEADER, ignoreCase = true)) {
                                setRequestProperty(k, v)
                            }
                        }
                    }
                    val stream = conn.inputStream
                    val mime = conn.contentType ?: "application/json"
                    WebResourceResponse(mime, conn.contentEncoding, stream)
                } catch (_: Exception) {
                    super.shouldInterceptRequest(view, request)
                }
            }

            override fun onPageStarted(
                view: WebView?,
                url: String?,
                favicon: android.graphics.Bitmap?,
            ) {
                view?.evaluateJavascript(
                    """
                    window.__SSC_ANDROID_CLIENT='$CLIENT_VALUE';
                    window.__SSC_ANDROID_SHELL='1';
                    window.__SSC_ANDROID_FEATURES='$SHELL_FEATURES';
                    """.trimIndent(),
                    null,
                )
                super.onPageStarted(view, url, favicon)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!bridgeInjected) {
                    bridgeInjected = true
                    injectBridgeScript(activity, view)
                }
                onLoadSuccess?.invoke()
                onPageFinished?.invoke()
                super.onPageFinished(view, url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame == true) {
                    onLoadError?.invoke()
                }
                super.onReceivedError(view, request, error)
            }
        }

    private fun injectBridgeScript(context: Context, view: WebView?) {
        if (view == null) return
        try {
            val script = context.assets.open("ssc_crypto_bridge.js")
                .bufferedReader()
                .use { it.readText() }
            view.evaluateJavascript(script, null)
        } catch (_: Exception) {
            // Bridge asset missing — WebView still loads; cryptoPolicy will hard-fail in production.
        }
    }
}