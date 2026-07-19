package com.supersecurechat.app.data

import com.supersecurechat.app.BuildConfig
import com.supersecurechat.app.SscDeviceAttest
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * Native HTTPS client for SSC API — no WebView.
 * Sends X-SSC-Client, X-SSC-Native-Bridge, X-SSC-Device-Id, optional Bearer.
 */
class SscHttpClient(
    private val session: SessionStore,
    private val apiBase: String = BuildConfig.SSC_API_URL.trimEnd('/'),
) {
    /** Invoked once on 401 so UI can force login (free path, no silent refresh yet). */
    @Volatile
    var onUnauthorized: (() -> Unit)? = null

    data class HttpResult(
        val code: Int,
        val body: String,
    ) {
        val ok: Boolean get() = code in 200..299

        fun jsonObject(): JSONObject = if (body.isBlank()) JSONObject() else JSONObject(body)

        fun jsonArray(key: String): JSONArray = jsonObject().optJSONArray(key) ?: JSONArray()
    }

    class ApiException(
        val status: Int,
        val detail: String,
        message: String = "HTTP $status: $detail",
    ) : Exception(message)

    fun get(path: String): HttpResult = request("GET", path, null)

    fun post(path: String, body: JSONObject? = null): HttpResult = request("POST", path, body)

    fun put(path: String, body: JSONObject? = null): HttpResult = request("PUT", path, body)

    fun patch(path: String, body: JSONObject? = null): HttpResult = request("PATCH", path, body)

    fun delete(path: String, body: JSONObject? = null): HttpResult = request("DELETE", path, body)

    fun requestJson(path: String, method: String = "GET", body: JSONObject? = null): JSONObject {
        val result = request(method, path, body)
        if (!result.ok) {
            if (result.code == 401 && !path.contains("/auth/login") && !path.contains("/auth/register")) {
                try {
                    onUnauthorized?.invoke()
                } catch (_: Exception) {
                }
            }
            val detail = try {
                result.jsonObject().optString("detail", result.body)
            } catch (_: Exception) {
                result.body
            }
            throw ApiException(result.code, detail.ifBlank { "request_failed" })
        }
        return result.jsonObject()
    }

    private fun request(method: String, path: String, body: JSONObject?): HttpResult {
        val url = if (path.startsWith("http")) path else "$apiBase${if (path.startsWith("/")) path else "/$path"}"
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 30_000
            readTimeout = 60_000
            doInput = true
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-SSC-Client", BuildConfig.SSC_CLIENT_IDENTITY)
            setRequestProperty("X-SSC-Native-Bridge", "v1")
            setRequestProperty("X-SSC-Device-Id", session.deviceId)
            SscDeviceAttest.currentToken()?.let {
                setRequestProperty(SscDeviceAttest.HEADER, it)
            }
            session.accessToken?.takeIf { it.isNotBlank() }?.let {
                setRequestProperty("Authorization", "Bearer $it")
            }
            if (body != null && method != "GET" && method != "HEAD") {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null && method != "GET" && method != "HEAD") {
                // Some Android stacks reject DELETE+body; still try for reaction APIs.
                conn.setRequestProperty("X-HTTP-Method-Override", method)
                OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body.toString()) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.let { input ->
                BufferedReader(InputStreamReader(input, StandardCharsets.UTF_8)).use { it.readText() }
            } ?: ""
            return HttpResult(code, text)
        } finally {
            conn.disconnect()
        }
    }

    fun wsUrl(): String {
        val base = apiBase.replace(Regex("^http"), "ws")
        return "$base/api/ws"
    }
}
