package com.supersecurechat.app

import android.webkit.CookieManager
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import org.json.JSONObject

/**
 * Native HTTP for WebView API calls — reliable cookies + X-SSC-Client from file:// origin.
 */
object SscApiBridge {
    fun fetch(
        url: String,
        method: String,
        headersJson: String?,
        body: String?,
        apiBase: String,
    ): JSONObject {
        val cookieManager = CookieManager.getInstance()
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method.uppercase()
            instanceFollowRedirects = true
            doInput = true
            ApiClient.attachInstalledClientHeaders(this)
            cookieManager.getCookie(url)?.takeIf { it.isNotBlank() }?.let { setRequestProperty("Cookie", it) }
            if (!headersJson.isNullOrBlank()) {
                val headers = JSONObject(headersJson)
                headers.keys().forEach { key ->
                    if (!key.equals(ApiClient.CLIENT_HEADER, ignoreCase = true)) {
                        setRequestProperty(key, headers.getString(key))
                    }
                }
            }
            val upper = method.uppercase()
            if (body != null && upper in setOf("POST", "PUT", "PATCH")) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            }
        }
        conn.connect()
        conn.headerFields.forEach { (key, values) ->
            if (key.equals("Set-Cookie", ignoreCase = true)) {
                values.forEach { cookieManager.setCookie(url, it) }
            }
        }
        cookieManager.flush()

        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
        return JSONObject()
            .put("ok", code in 200..299)
            .put("status", code)
            .put("body", text)
    }
}