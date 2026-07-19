package com.supersecurechat.app.data

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * Native WebSocket client for SSC realtime.
 * Auth: first-frame { type: "auth", token } (production-safe; no query token).
 * Auto-reconnect when wantConnected; exposes connectionState for UI banner.
 */
class SscRealtime(
    private val http: SscHttpClient,
    private val session: SessionStore,
) {
    fun interface Listener {
        fun onEvent(type: String, payload: JSONObject)
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val listeners = CopyOnWriteArrayList<Listener>()
    private val socketRef = AtomicReference<WebSocket?>(null)
    private val connected = AtomicBoolean(false)
    private val desiredTopics = linkedSetOf<String>()
    private val lock = Any()
    private val wantConnected = AtomicBoolean(false)
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private val reconnectScheduled = AtomicBoolean(false)

    private val _connectionState = MutableStateFlow("offline") // offline|connecting|online
    val connectionState: StateFlow<String> = _connectionState.asStateFlow()

    fun addListener(listener: Listener) {
        listeners.add(listener)
    }

    fun removeListener(listener: Listener) {
        listeners.remove(listener)
    }

    fun connect() {
        val token = session.accessToken
        if (token.isNullOrBlank()) return
        wantConnected.set(true)
        disconnectSocketOnly()
        _connectionState.value = "connecting"
        val url = http.wsUrl()
        val request = Request.Builder().url(url).build()
        val ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val auth = JSONObject().put("type", "auth").put("token", token)
                webSocket.send(auth.toString())
                connected.set(true)
                reconnectScheduled.set(false)
                _connectionState.value = "online"
                dispatch("connected", JSONObject())
                resubscribeAll(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type", "event")
                    dispatch(type, json)
                } catch (e: Exception) {
                    Log.w(TAG, "ws parse: ${e.message}")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                connected.set(false)
                _connectionState.value = "offline"
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected.set(false)
                _connectionState.value = "offline"
                dispatch("disconnected", JSONObject().put("code", code).put("reason", reason))
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected.set(false)
                _connectionState.value = "offline"
                Log.w(TAG, "ws failure: ${t.message}")
                dispatch("error", JSONObject().put("detail", t.message ?: "ws_failure"))
                scheduleReconnect()
            }
        })
        socketRef.set(ws)
    }

    fun disconnect() {
        wantConnected.set(false)
        reconnectScheduled.set(false)
        disconnectSocketOnly()
        _connectionState.value = "offline"
    }

    private fun disconnectSocketOnly() {
        socketRef.getAndSet(null)?.close(1000, "client_close")
        connected.set(false)
    }

    private fun scheduleReconnect() {
        if (!wantConnected.get()) return
        if (!reconnectScheduled.compareAndSet(false, true)) return
        scheduler.schedule({
            reconnectScheduled.set(false)
            if (wantConnected.get() && !connected.get()) {
                Log.i(TAG, "reconnecting…")
                try {
                    connect()
                } catch (e: Exception) {
                    Log.w(TAG, "reconnect: ${e.message}")
                    scheduleReconnect()
                }
            }
        }, 3, TimeUnit.SECONDS)
    }

    fun isConnected(): Boolean = connected.get()

    fun setTopics(topics: Collection<String>) {
        synchronized(lock) {
            desiredTopics.clear()
            desiredTopics.addAll(topics.filter { it.isNotBlank() })
        }
        val ws = socketRef.get() ?: return
        if (connected.get()) resubscribeAll(ws)
    }

    fun subscribe(topic: String) {
        synchronized(lock) { desiredTopics.add(topic) }
        val ws = socketRef.get() ?: return
        if (connected.get()) subscribeOne(ws, topic)
    }

    private fun resubscribeAll(ws: WebSocket) {
        val topics = synchronized(lock) { desiredTopics.toList() }
        topics.forEach { subscribeOne(ws, it) }
    }

    private fun subscribeOne(ws: WebSocket, topic: String) {
        try {
            var subscribeToken: String? = null
            try {
                val tok = http.requestJson(
                    "/api/ws/subscribe-token?topic=${java.net.URLEncoder.encode(topic, "UTF-8")}",
                    "GET",
                )
                subscribeToken = tok.optString("subscribe_token").ifBlank { null }
            } catch (_: Exception) {
            }
            val frame = JSONObject().put("type", "subscribe").put("topic", topic)
            if (!subscribeToken.isNullOrBlank()) {
                frame.put("subscribe_token", subscribeToken)
            }
            ws.send(frame.toString())
        } catch (e: Exception) {
            Log.w(TAG, "subscribe $topic: ${e.message}")
        }
    }

    private fun dispatch(type: String, payload: JSONObject) {
        listeners.forEach { listener ->
            try {
                listener.onEvent(type, payload)
            } catch (e: Exception) {
                Log.w(TAG, "listener: ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "SscRealtime"
    }
}
