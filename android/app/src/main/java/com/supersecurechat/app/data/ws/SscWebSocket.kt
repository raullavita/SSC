package com.supersecurechat.app.data.ws

import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.model.WsSubscribeTokenResponse
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

data class WsEvent(
    val topic: String?,
    val type: String?,
    val payload: JsonObject?,
)

class SscWebSocket(
    private val http: SscHttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private var socket: WebSocket? = null
    private val _events = MutableSharedFlow<WsEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<WsEvent> = _events.asSharedFlow()

    fun connect(wsToken: String) {
        disconnect()
        socket = http.openWebSocket(
            "/api/ws",
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    webSocket.send(
                        JSONObject()
                            .put("type", "auth")
                            .put("token", wsToken)
                            .toString(),
                    )
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    emitFrame(text)
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    // Reconnect handled by ChatSessionManager if needed.
                }
            },
        )
    }

    suspend fun subscribe(topic: String) {
        val subscribeToken = fetchSubscribeToken(topic)
        val frame = JSONObject()
            .put("type", "subscribe")
            .put("topic", topic)
        if (!subscribeToken.isNullOrBlank()) {
            frame.put("subscribe_token", subscribeToken)
        }
        socket?.send(frame.toString())
    }

    fun disconnect() {
        socket?.close(1000, "bye")
        socket = null
    }

    private suspend fun fetchSubscribeToken(topic: String): String? {
        return try {
            val body = http.get("/api/ws/subscribe-token?topic=${java.net.URLEncoder.encode(topic, "UTF-8")}")
            val parsed = json.decodeFromString(WsSubscribeTokenResponse.serializer(), body)
            if (parsed.required && parsed.subscribeToken.isNullOrBlank()) null else parsed.subscribeToken
        } catch (_: Exception) {
            null
        }
    }

    private fun emitFrame(text: String) {
        val root = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        val type = root["type"]?.jsonPrimitive?.content
        if (type == "subscribed") {
            return
        }
        val topic = root["topic"]?.jsonPrimitive?.content
        val payload = root["payload"]?.jsonObject ?: root
        val eventType = payload["type"]?.jsonPrimitive?.content
            ?: when {
                payload["message"] != null -> "message"
                else -> type
            }
        _events.tryEmit(WsEvent(topic = topic, type = eventType, payload = payload))
    }
}