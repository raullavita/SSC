package com.supersecurechat.app.data.api

import android.content.Context
import com.supersecurechat.app.BuildConfig
import com.supersecurechat.app.SscDeviceAttest
import com.supersecurechat.app.data.model.ApiErrorResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.io.IOException
import java.util.concurrent.TimeUnit

class SscHttpClient private constructor(
    private val client: OkHttpClient,
    private val baseUrl: String,
    private val json: Json,
) {
    val cookieJar: PersistentCookieJar
        get() = client.cookieJar as PersistentCookieJar

    suspend fun get(path: String): String = execute(Request.Builder().url(url(path)).get().build())

    suspend fun post(path: String, body: String): String {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = body.toRequestBody(mediaType)
        return execute(Request.Builder().url(url(path)).post(requestBody).build())
    }

    suspend fun put(path: String, body: String): String {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = body.toRequestBody(mediaType)
        return execute(Request.Builder().url(url(path)).put(requestBody).build())
    }

    fun openWebSocket(path: String, listener: WebSocketListener): WebSocket {
        val request = Request.Builder()
            .url(url(path))
            .header(CLIENT_HEADER, CLIENT_VALUE)
            .header(NATIVE_BRIDGE_HEADER, NATIVE_BRIDGE_VALUE)
            .apply {
                SscDeviceAttest.currentToken()?.let { header(SscDeviceAttest.HEADER, it) }
            }
            .build()
        return client.newWebSocket(request, listener)
    }

    private fun url(path: String): String {
        val normalized = if (path.startsWith("/")) path else "/$path"
        return baseUrl.trimEnd('/') + normalized
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        val built = request.newBuilder()
            .header(CLIENT_HEADER, CLIENT_VALUE)
            .header(NATIVE_BRIDGE_HEADER, NATIVE_BRIDGE_VALUE)
            .apply {
                SscDeviceAttest.currentToken()?.let { header(SscDeviceAttest.HEADER, it) }
            }
            .build()

        val response = try {
            client.newCall(built).execute()
        } catch (e: IOException) {
            val detail = when {
                e.message?.contains("Certificate pinning", ignoreCase = true) == true ->
                    "certificate_pin_mismatch"
                e.message?.contains("SSL", ignoreCase = true) == true ||
                    e.message?.contains("TLS", ignoreCase = true) == true ->
                    "ssl_connection_failed"
                else -> "network_error"
            }
            throw ApiException(0, detail)
        }

        response.use { resp ->
            val body = resp.body?.string().orEmpty()
            if (resp.isSuccessful) {
                return@withContext body
            }
            val detail = runCatching {
                json.decodeFromString(ApiErrorResponse.serializer(), body).detail
            }.getOrNull() ?: body.ifBlank { "request_failed" }
            throw ApiException(resp.code, detail)
        }
    }

    companion object {
        const val CLIENT_HEADER = "X-SSC-Client"
        const val NATIVE_BRIDGE_HEADER = "X-SSC-Native-Bridge"
        const val NATIVE_BRIDGE_VALUE = "v1"
        const val CLIENT_VALUE = "android/0.3.1/10"

        private val json = Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

        fun create(context: Context): SscHttpClient {
            val cookieJar = PersistentCookieJar(context)
            val okHttp = OkHttpClient.Builder()
                .cookieJar(cookieJar)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
            return SscHttpClient(okHttp, BuildConfig.SSC_API_URL, json)
        }
    }
}