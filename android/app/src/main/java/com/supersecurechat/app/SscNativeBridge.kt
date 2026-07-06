package com.supersecurechat.app

import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Async libsignal bridge for WebView — mirrors Electron preload `window.sscCrypto`.
 */
class SscNativeBridge(
    private val activity: Activity,
    private val webView: WebView,
    filesDir: java.io.File,
) {
    private val executor = Executors.newSingleThreadExecutor()

    init {
        SscCryptoService.bind(filesDir)
    }

    @JavascriptInterface
    fun fetchApi(url: String, method: String, headersJson: String, body: String, callbackId: String) {
        executor.execute {
            try {
                val apiBase = BuildConfig.SSC_API_URL
                val result = SscApiBridge.fetch(url, method, headersJson, body.ifBlank { null }, apiBase)
                deliver(callbackId, result.getBoolean("ok"), result)
            } catch (error: Throwable) {
                deliver(callbackId, false, error.message ?: "ssc_api_error")
            }
        }
    }

    @JavascriptInterface
    fun invoke(method: String, callbackId: String, argsJson: String) {
        executor.execute {
            try {
                val args = if (argsJson.isBlank()) JSONObject() else JSONObject(argsJson)
                val result = when {
                    method.startsWith("translate") -> SscTranslateService.dispatch(method, args)
                    else -> SscCryptoService.dispatch(method, args)
                }
                deliver(callbackId, true, result)
            } catch (error: Throwable) {
                deliver(callbackId, false, error.message ?: "ssc_native_error")
            }
        }
    }

    private fun deliver(callbackId: String, ok: Boolean, payload: Any) {
        val encoded = when (payload) {
            is String -> JSONObject.quote(payload)
            is JSONObject -> payload.toString()
            else -> JSONObject.quote(payload.toString())
        }
        val js = "window.__sscBridge._callback(${JSONObject.quote(callbackId)},$ok,$encoded);"
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }
}