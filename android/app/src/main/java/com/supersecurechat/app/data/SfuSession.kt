package com.supersecurechat.app.data

import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * mediasoup SFU WebSocket session — wire protocol matches `sfu-server/wsHandler.js`
 * (live-hardened: existingProducers on join, producerClosed, getProducers).
 */
class SfuSession(
    private val wsUrl: String,
    private val roomId: String,
    private val joinToken: String,
    private val peerId: String = "ssc-${UUID.randomUUID().toString().take(8)}",
    private val onNewProducer: ((peerId: String, producerId: String, kind: String) -> Unit)? = null,
    private val onProducerClosed: ((producerId: String) -> Unit)? = null,
    private val onError: ((String) -> Unit)? = null,
) {
    data class TransportCreated(
        val id: String,
        val direction: String,
        val iceParameters: JSONObject,
        val iceCandidates: JSONArray,
        val dtlsParameters: JSONObject,
    )

    data class Consumed(
        val id: String,
        val producerId: String,
        val kind: String,
        val rtpParameters: JSONObject,
    )

    data class ExistingProducer(
        val peerId: String,
        val producerId: String,
        val kind: String,
    )

    private data class Waiter(
        val action: String,
        val predicate: (JSONObject) -> Boolean,
        val deferred: CompletableDeferred<JSONObject>,
    )

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var ws: WebSocket? = null
    private val open = AtomicBoolean(false)
    private val waiters = CopyOnWriteArrayList<Waiter>()
    private val earlyMessages = ConcurrentLinkedQueue<JSONObject>()

    var joined = false
        private set
    var rtpCapabilities: JSONObject? = null
        private set
    var existingProducers: List<ExistingProducer> = emptyList()
        private set
    val localPeerId: String get() = peerId

    suspend fun connect(timeoutMs: Long = 15_000) {
        if (open.get() && joined) return
        if (wsUrl.isBlank() || roomId.isBlank() || joinToken.isBlank()) {
            throw IllegalStateException("sfu_missing_params")
        }
        withTimeout(timeoutMs) {
            val opened = CompletableDeferred<Unit>()
            val req = Request.Builder().url(wsUrl).build()
            ws = client.newWebSocket(req, object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    open.set(true)
                    opened.complete(Unit)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    handleMessage(text)
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    open.set(false)
                    val msg = t.message ?: "sfu_ws_failed"
                    Log.e(TAG, "ws failure: $msg", t)
                    onError?.invoke(msg)
                    if (!opened.isCompleted) opened.completeExceptionally(Exception(msg))
                    failAll(msg)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    open.set(false)
                    failAll("sfu_ws_closed")
                }
            })
            opened.await()
        }

        send(
            JSONObject()
                .put("action", "join")
                .put("roomId", roomId)
                .put("joinToken", joinToken)
                .put("peerId", peerId),
        )
        val joinedMsg = awaitAction("joined", timeoutMs)
        if (joinedMsg.optString("action") == "error") {
            throw IllegalStateException(joinedMsg.optString("error", "join_failed"))
        }
        rtpCapabilities = joinedMsg.optJSONObject("rtpCapabilities")
        existingProducers = parseExistingProducers(joinedMsg.optJSONArray("existingProducers"))
        joined = true
        Log.i(TAG, "joined room=$roomId peer=$peerId existing=${existingProducers.size}")
    }

    /** Refresh producer list (late recovery). */
    suspend fun getProducers(timeoutMs: Long = 8_000): List<ExistingProducer> {
        send(JSONObject().put("action", "getProducers"))
        val msg = awaitAction("producers", timeoutMs)
        val list = parseExistingProducers(msg.optJSONArray("producers"))
        existingProducers = list
        return list
    }

    suspend fun createWebRtcTransport(direction: String, timeoutMs: Long = 12_000): TransportCreated {
        send(JSONObject().put("action", "createWebRtcTransport").put("direction", direction))
        val msg = awaitAction("webRtcTransportCreated", timeoutMs) { m ->
            m.optString("direction") == direction
        }
        return TransportCreated(
            id = msg.getString("id"),
            direction = direction,
            iceParameters = msg.getJSONObject("iceParameters"),
            iceCandidates = msg.optJSONArray("iceCandidates") ?: JSONArray(),
            dtlsParameters = msg.getJSONObject("dtlsParameters"),
        )
    }

    suspend fun connectWebRtcTransport(
        transportId: String,
        dtlsParameters: JSONObject,
        timeoutMs: Long = 12_000,
    ) {
        send(
            JSONObject()
                .put("action", "connectWebRtcTransport")
                .put("transportId", transportId)
                .put("dtlsParameters", dtlsParameters),
        )
        awaitAction("webRtcTransportConnected", timeoutMs) { m ->
            m.optString("transportId") == transportId
        }
    }

    suspend fun produce(
        transportId: String,
        kind: String,
        rtpParameters: JSONObject,
        timeoutMs: Long = 12_000,
    ): String {
        send(
            JSONObject()
                .put("action", "produce")
                .put("transportId", transportId)
                .put("kind", kind)
                .put("rtpParameters", rtpParameters),
        )
        val msg = awaitAction("produced", timeoutMs)
        if (msg.optString("action") == "error" || msg.has("error")) {
            throw IllegalStateException(msg.optString("error", "produce_failed"))
        }
        return msg.getString("id")
    }

    suspend fun consume(
        transportId: String,
        producerId: String,
        rtpCapabilities: JSONObject,
        timeoutMs: Long = 12_000,
    ): Consumed {
        send(
            JSONObject()
                .put("action", "consume")
                .put("transportId", transportId)
                .put("producerId", producerId)
                .put("rtpCapabilities", rtpCapabilities),
        )
        val msg = awaitAction("consumed", timeoutMs) { m ->
            m.optString("producerId") == producerId
        }
        if (msg.has("error")) {
            throw IllegalStateException(msg.optString("error", "consume_failed"))
        }
        return Consumed(
            id = msg.getString("id"),
            producerId = producerId,
            kind = msg.optString("kind", "audio"),
            rtpParameters = msg.getJSONObject("rtpParameters"),
        )
    }

    suspend fun resumeConsumer(consumerId: String, timeoutMs: Long = 8_000) {
        send(
            JSONObject()
                .put("action", "resumeConsumer")
                .put("consumerId", consumerId),
        )
        awaitAction("consumerResumed", timeoutMs) { m ->
            m.optString("consumerId") == consumerId
        }
    }

    fun close() {
        joined = false
        open.set(false)
        failAll("sfu_closed")
        try {
            ws?.close(1000, "bye")
        } catch (_: Exception) {
        }
        ws = null
    }

    private fun send(obj: JSONObject) {
        val socket = ws ?: throw IllegalStateException("sfu_not_connected")
        if (!socket.send(obj.toString())) {
            throw IllegalStateException("sfu_send_failed")
        }
    }

    private fun handleMessage(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (_: Exception) {
            return
        }
        val action = msg.optString("action")
        when (action) {
            "error" -> {
                val err = msg.optString("error", "sfu_error")
                Log.w(TAG, "sfu error: $err")
                onError?.invoke(err)
                // Wake a waiter if any is waiting for this action-less error mid-handshake
                deliver(action, msg)
            }
            "newProducer" -> {
                val pId = msg.optString("producerId")
                val kind = msg.optString("kind", "audio")
                val from = msg.optString("peerId", "")
                if (pId.isNotBlank()) {
                    onNewProducer?.invoke(from, pId, kind)
                }
            }
            "producerClosed" -> {
                val pId = msg.optString("producerId")
                if (pId.isNotBlank()) onProducerClosed?.invoke(pId)
            }
            else -> deliver(action, msg)
        }
    }

    private fun deliver(action: String, msg: JSONObject) {
        val it = waiters.iterator()
        while (it.hasNext()) {
            val w = it.next()
            if (w.action == action && w.predicate(msg) && !w.deferred.isCompleted) {
                waiters.remove(w)
                w.deferred.complete(msg)
                return
            }
        }
        if (action.isNotBlank() && action != "error" &&
            action != "newProducer" && action != "producerClosed" &&
            action != "peerJoined" && action != "peerLeft"
        ) {
            earlyMessages.offer(msg)
            while (earlyMessages.size > 48) earlyMessages.poll()
        }
    }

    private suspend fun awaitAction(
        action: String,
        timeoutMs: Long,
        predicate: (JSONObject) -> Boolean = { true },
    ): JSONObject {
        val buffered = earlyMessages.firstOrNull { m ->
            m.optString("action") == action && predicate(m)
        }
        if (buffered != null) {
            earlyMessages.remove(buffered)
            return buffered
        }
        val deferred = CompletableDeferred<JSONObject>()
        val waiter = Waiter(action, predicate, deferred)
        waiters.add(waiter)
        return try {
            withTimeout(timeoutMs) { deferred.await() }
        } finally {
            waiters.remove(waiter)
        }
    }

    private fun failAll(reason: String) {
        waiters.forEach { w ->
            if (!w.deferred.isCompleted) {
                w.deferred.completeExceptionally(Exception(reason))
            }
        }
        waiters.clear()
    }

    private fun parseExistingProducers(arr: JSONArray?): List<ExistingProducer> {
        if (arr == null) return emptyList()
        val out = ArrayList<ExistingProducer>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val pid = o.optString("producerId")
            if (pid.isBlank()) continue
            out.add(
                ExistingProducer(
                    peerId = o.optString("peerId", ""),
                    producerId = pid,
                    kind = o.optString("kind", "audio"),
                ),
            )
        }
        return out
    }

    companion object {
        private const val TAG = "SfuSession"
    }
}
