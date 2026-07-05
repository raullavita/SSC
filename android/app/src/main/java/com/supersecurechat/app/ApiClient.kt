package com.supersecurechat.app

import android.content.Context
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
    const val CLIENT_VALUE = "android/0.3.0/6"
    const val SHELL_FEATURES = "splash_screen,deep_links,pull_to_refresh,offline_retry,file_chooser,edge_to_edge"

    fun attachInstalledClientHeaders(conn: HttpURLConnection) {
        conn.setRequestProperty(CLIENT_HEADER, CLIENT_VALUE)
    }

    fun webViewClient(
        context: Context,
        baseUrl: String,
        webView: WebView,
        onPageFinished: (() -> Unit)? = null,
        onLoadError: (() -> Unit)? = null,
        onLoadSuccess: (() -> Unit)? = null,
    ): WebViewClient =
        object : WebViewClient() {
            private var bridgeInjected = false

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?,
            ): WebResourceResponse? {
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
                    injectBridgeScript(context, view)
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