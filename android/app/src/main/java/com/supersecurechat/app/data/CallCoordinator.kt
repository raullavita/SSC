package com.supersecurechat.app.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.IceCandidate
import org.webrtc.SessionDescription
import org.webrtc.SurfaceViewRenderer
import java.util.concurrent.CopyOnWriteArrayList

/**
 * App-level call state: 1:1 mesh WebRTC + group SFU (mediasoup).
 * Signaling plaintext matches web client: { sdp: {...} } / { candidate: {...} }.
 */
class CallCoordinator(
    private val context: Context,
    private val calls: CallsRepository,
    private val signal: SignalMessaging,
    private val scope: CoroutineScope,
) {
    data class IncomingCall(
        val callId: String,
        val fromUserId: String?,
        val conversationId: String?,
        val video: Boolean,
    )

    data class UiState(
        val status: String = "idle", // idle|ringing|incoming|connecting|connected|ended
        val callId: String? = null,
        val peerId: String? = null,
        val conversationId: String? = null,
        val video: Boolean = false,
        val error: String? = null,
        val incoming: IncomingCall? = null,
        /** mesh | sfu */
        val mode: String = "mesh",
        val sfuRoomId: String? = null,
        val micEnabled: Boolean = true,
        val camEnabled: Boolean = false,
        val remoteAudio: Boolean = false,
        val remoteVideo: Boolean = false,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var rtc: WebRtcCallSession? = null
    private var sfuSession: SfuSession? = null
    private var sfuMedia: SfuMediaEngine? = null
    private var sfuRepo: SfuRepository? = null
    private var pendingOffer: SessionDescription? = null
    private val pendingIce = CopyOnWriteArrayList<IceCandidate>()
    private var ringJob: Job? = null

    private fun startRingTimer(callId: String) {
        ringJob?.cancel()
        ringJob = scope.launch {
            delay(RING_TIMEOUT_MS)
            if (_state.value.callId == callId &&
                (_state.value.status == "ringing" || _state.value.status == "incoming")
            ) {
                try {
                    withContextIo { calls.endCall(callId, "missed") }
                } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
                cleanup("missed")
                _state.value = UiState(status = "idle", error = "no_answer")
            }
        }
    }

    fun onWsEvent(type: String, payload: JSONObject) {
        when (type) {
            "incoming_call" -> {
                val call = payload.optJSONObject("call") ?: return
                val id = call.optString("id", call.optString("_id", ""))
                if (id.isBlank()) return
                if (_state.value.status != "idle") {
                    scope.launch(Dispatchers.IO) {
                        try {
                            calls.endCall(id, "busy")
                        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
                    }
                    return
                }
                val mode = call.optString("mode").ifBlank {
                    if (call.optBoolean("group_call", false)) "sfu" else "mesh"
                }
                _state.value = UiState(
                    status = "incoming",
                    callId = id,
                    peerId = call.optString("caller_id").ifBlank { null },
                    conversationId = call.optString("conversation_id").ifBlank { null },
                    video = call.optBoolean("video", false),
                    mode = if (mode == "sfu") "sfu" else "mesh",
                    sfuRoomId = call.optString("sfu_room_id").ifBlank { null },
                    incoming = IncomingCall(
                        callId = id,
                        fromUserId = call.optString("caller_id").ifBlank { null },
                        conversationId = call.optString("conversation_id").ifBlank { null },
                        video = call.optBoolean("video", false),
                    ),
                )
                startRingTimer(id)
            }
            "call_ended" -> {
                val id = payload.optString("call_id")
                if (id.isNotBlank() && id == _state.value.callId) {
                    cleanup(payload.optString("reason", "ended"))
                }
            }
            "call_signal" -> {
                val callId = payload.optString("call_id")
                val signalType = payload.optString("signal_type")
                val ciphertext = payload.optString("ciphertext")
                val from = payload.optString("from")
                if (callId.isBlank() || ciphertext.isBlank()) return
                scope.launch(Dispatchers.IO) {
                    try {
                        handleRemoteSignal(callId, signalType, ciphertext, from)
                    } catch (e: Exception) {
                        Log.w(TAG, "signal: ${e.message}")
                    }
                }
            }
            "sfu_room" -> {
                // Host shared SFU room credentials for joiners
                val roomId = payload.optString("room_id")
                val token = payload.optString("join_token")
                val wsUrl = payload.optString("ws_url")
                val conv = payload.optString("conversation_id")
                val from = payload.optString("from").ifBlank { null }
                if (roomId.isBlank() || token.isBlank() || wsUrl.isBlank()) return
                // Already in this SFU room
                if (_state.value.sfuRoomId == roomId && _state.value.status == "connected") return
                if (_state.value.status == "idle" ||
                    _state.value.status == "incoming" ||
                    _state.value.conversationId == conv
                ) {
                    pendingSfuJoin = PendingSfu(wsUrl, roomId, token)
                    val ringId = "sfu:$roomId"
                    _state.value = UiState(
                        status = "incoming",
                        callId = ringId,
                        peerId = from,
                        conversationId = conv.ifBlank { _state.value.conversationId },
                        video = payload.optBoolean("video", _state.value.video),
                        mode = "sfu",
                        sfuRoomId = roomId,
                        incoming = IncomingCall(
                            callId = ringId,
                            fromUserId = from,
                            conversationId = conv.ifBlank { null },
                            video = payload.optBoolean("video", false),
                        ),
                    )
                    startRingTimer(ringId)
                }
            }
            "sfu_room_ended" -> {
                val roomId = payload.optString("room_id")
                if (roomId.isNotBlank() && roomId == _state.value.sfuRoomId) {
                    cleanup("ended")
                }
            }
            else -> {
                when (payload.optString("type")) {
                    "incoming_call", "call_ended", "call_signal", "sfu_room", "sfu_room_ended" ->
                        onWsEvent(payload.optString("type"), payload)
                }
            }
        }
    }

    private data class PendingSfu(val wsUrl: String, val roomId: String, val joinToken: String)
    private var pendingSfuJoin: PendingSfu? = null
    private var lastLocalUserId: String? = null

    /** Call when session is known so SFU join uses a stable peer id. */
    fun setLocalUserId(userId: String?) {
        if (!userId.isNullOrBlank()) lastLocalUserId = userId
    }

    fun startOutgoing(
        conversationId: String,
        peerId: String?,
        video: Boolean = false,
        groupCall: Boolean = false,
        sfu: SfuRepository? = null,
        expectedParticipants: Int = 2,
        localUserId: String? = null,
    ) {
        if (_state.value.status != "idle") return
        sfuRepo = sfu
        lastLocalUserId = localUserId
        scope.launch {
            try {
                _state.value = UiState(
                    status = "ringing",
                    peerId = peerId,
                    conversationId = conversationId,
                    video = video,
                    camEnabled = video,
                )
                val ice = withContextIo { calls.iceServers() }

                // Group → prefer SFU when enabled
                if (groupCall && sfu != null) {
                    val cfg = withContextIo { sfu.config() }
                    if (cfg.enabled && !cfg.wsUrl.isNullOrBlank()) {
                        _state.value = _state.value.copy(status = "connecting", mode = "sfu")
                        // Backend rejects expected_participants > conversation size
                        val room = withContextIo {
                            sfu.createRoom(conversationId, expectedParticipants.coerceIn(2, 50))
                        }
                        if (room.roomId.isBlank() || room.joinToken.isNullOrBlank() || room.wsUrl.isNullOrBlank()) {
                            throw IllegalStateException("sfu_room_incomplete")
                        }
                        connectSfu(
                            wsUrl = room.wsUrl,
                            roomId = room.roomId,
                            joinToken = room.joinToken,
                            video = video,
                            ice = ice,
                            peerKey = localUserId ?: lastLocalUserId ?: "android",
                        )
                        // Also create call session for ringing/presence metadata
                        try {
                            val (session, _) = withContextIo {
                                calls.startCall(
                                    conversationId,
                                    peerId,
                                    video = video,
                                    groupCall = true,
                                )
                            }
                            _state.value = _state.value.copy(
                                callId = session.id,
                                sfuRoomId = room.roomId,
                                status = "connected",
                                mode = "sfu",
                            )
                        } catch (e: Exception) {
                            // SFU media may still work without call row
                            Log.w(TAG, "call row: ${e.message}")
                            _state.value = _state.value.copy(
                                sfuRoomId = room.roomId,
                                status = "connected",
                                mode = "sfu",
                                callId = room.roomId,
                            )
                        }
                        ringJob?.cancel()
                        return@launch
                    }
                }

                val (session, sfuRequired) = withContextIo {
                    calls.startCall(
                        conversationId,
                        peerId,
                        video = video,
                        groupCall = groupCall,
                    )
                }
                _state.value = _state.value.copy(
                    callId = session.id,
                    status = "ringing",
                    peerId = peerId ?: session.calleeId,
                    mode = if (sfuRequired) "sfu" else "mesh",
                    error = if (sfuRequired && sfuMedia == null) "sfu_required_unavailable" else null,
                )
                startRingTimer(session.id)
                val target = peerId ?: session.calleeId
                if (!groupCall && !target.isNullOrBlank()) {
                    val rtcSession = createRtc(ice, video)
                    rtc = rtcSession
                    rtcSession.startAsCaller(video = video) { offer ->
                        scope.launch(Dispatchers.IO) {
                            relay(session.id, target, "offer", JSONObject().put("sdp", offer.toJson()))
                        }
                    }
                }
            } catch (e: Exception) {
                _state.value = UiState(status = "idle", error = e.message)
                cleanup("failed")
            }
        }
    }

    /**
     * Join an existing SFU room (group callee / late joiner).
     */
    fun joinSfuRoom(
        wsUrl: String,
        roomId: String,
        joinToken: String,
        conversationId: String?,
        video: Boolean = false,
        sfu: SfuRepository? = null,
        localUserId: String? = null,
    ) {
        if (_state.value.status != "idle" && _state.value.status != "incoming") return
        sfuRepo = sfu
        if (localUserId != null) lastLocalUserId = localUserId
        scope.launch {
            try {
                _state.value = _state.value.copy(
                    status = "connecting",
                    mode = "sfu",
                    sfuRoomId = roomId,
                    conversationId = conversationId ?: _state.value.conversationId,
                    video = video,
                    camEnabled = video,
                )
                val ice = withContextIo { calls.iceServers() }
                connectSfu(
                    wsUrl = wsUrl,
                    roomId = roomId,
                    joinToken = joinToken,
                    video = video,
                    ice = ice,
                    peerKey = localUserId ?: lastLocalUserId ?: "android",
                )
                ringJob?.cancel()
                _state.value = _state.value.copy(status = "connected", incoming = null)
            } catch (e: Exception) {
                _state.value = UiState(status = "idle", error = e.message)
                cleanup("failed")
            }
        }
    }

    fun bindLocalVideo(renderer: SurfaceViewRenderer) {
        sfuMedia?.bindLocalVideo(renderer)
        rtc?.bindLocalVideo(renderer)
    }

    fun bindRemoteVideo(renderer: SurfaceViewRenderer) {
        sfuMedia?.bindRemoteVideo(renderer)
        rtc?.bindRemoteVideo(renderer)
    }

    fun unbindVideoRenderers() {
        try {
            sfuMedia?.unbindVideoRenderers()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        try {
            rtc?.unbindVideoRenderers()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
    }

    private suspend fun connectSfu(
        wsUrl: String,
        roomId: String,
        joinToken: String,
        video: Boolean,
        ice: List<org.webrtc.PeerConnection.IceServer>,
        peerKey: String,
    ) {
        val session = SfuSession(
            wsUrl = wsUrl,
            roomId = roomId,
            joinToken = joinToken,
            peerId = peerKey,
            onNewProducer = { _, producerId, kind ->
                sfuMedia?.consumeProducer(producerId, kind)
            },
            onProducerClosed = { producerId ->
                sfuMedia?.onProducerClosed(producerId)
            },
            onError = { err ->
                scope.launch {
                    val friendly = when {
                        err.contains("room_not_found") -> "SFU room not found (is SFU server running?)"
                        err.contains("invalid_token") -> "SFU join token rejected"
                        err.contains("sfu_ws") -> "Cannot reach SFU WebSocket ($wsUrl)"
                        err.contains("cannot_consume") -> "Codec mismatch — cannot consume remote media"
                        else -> err
                    }
                    _state.value = _state.value.copy(error = friendly)
                }
            },
        )
        sfuSession = session
        try {
            session.connect()
        } catch (e: Exception) {
            throw IllegalStateException(
                "SFU join failed: ${e.message}. Check WSS $wsUrl and room token.",
                e,
            )
        }
        val media = SfuMediaEngine(
            context = context,
            session = session,
            iceServers = ice,
            scope = scope,
            onRemoteTrack = { kind, _ ->
                scope.launch {
                    _state.value = _state.value.copy(
                        status = "connected",
                        remoteAudio = _state.value.remoteAudio || kind == "audio",
                        remoteVideo = _state.value.remoteVideo || kind == "video",
                    )
                }
            },
            onState = { name ->
                scope.launch {
                    when {
                        name == "sfu_ready" || name.contains("CONNECTED", true) -> {
                            _state.value = _state.value.copy(status = "connected", error = null)
                        }
                        name.startsWith("produce_audio_failed") ||
                            name.startsWith("consume_failed") -> {
                            _state.value = _state.value.copy(error = name)
                        }
                    }
                }
            },
        )
        sfuMedia = media
        try {
            media.start(publishAudio = true, publishVideo = video)
        } catch (e: Exception) {
            throw IllegalStateException(
                "SFU media failed: ${e.message}. Check mic permission, ICE/TURN, and SFU_ANNOUNCED_IP.",
                e,
            )
        }
    }

    fun answerIncoming() {
        val st = _state.value
        val callId = st.callId
        // SFU join path
        val pending = pendingSfuJoin
        if (st.mode == "sfu" && pending != null) {
            joinSfuRoom(
                wsUrl = pending.wsUrl,
                roomId = pending.roomId,
                joinToken = pending.joinToken,
                conversationId = st.conversationId,
                video = st.video,
                sfu = sfuRepo,
                localUserId = lastLocalUserId,
            )
            pendingSfuJoin = null
            return
        }
        if (callId == null) return
        val peerId = st.peerId ?: return
        val offer = pendingOffer ?: return
        scope.launch {
            try {
                _state.value = st.copy(status = "connecting")
                val ice = withContextIo { calls.iceServers() }
                val rtcSession = createRtc(ice, st.video)
                rtc = rtcSession
                rtcSession.acceptRemoteOffer(offer, video = st.video) { answer ->
                    scope.launch(Dispatchers.IO) {
                        relay(callId, peerId, "answer", JSONObject().put("sdp", answer.toJson()))
                    }
                    _state.value = _state.value.copy(status = "connected", incoming = null)
                }
                pendingIce.forEach { rtcSession.addIce(it) }
                pendingIce.clear()
                pendingOffer = null
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
                hangup("ended")
            }
        }
    }

    fun declineIncoming() {
        val id = _state.value.callId
        if (id != null) {
            scope.launch(Dispatchers.IO) {
                try {
                    calls.endCall(id, "declined")
                } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
            }
        }
        cleanup("declined")
    }

    fun hangup(reason: String = "ended") {
        val id = _state.value.callId
        val peer = _state.value.peerId
        val roomId = _state.value.sfuRoomId
        val mode = _state.value.mode
        scope.launch(Dispatchers.IO) {
            if (id != null && peer != null && mode != "sfu") {
                try {
                    relay(id, peer, "hangup", JSONObject().put("reason", reason))
                } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
            }
            if (id != null) {
                try {
                    calls.endCall(id, reason)
                } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
            }
            if (mode == "sfu" && !roomId.isNullOrBlank()) {
                try {
                    sfuRepo?.endRoom(roomId)
                } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
            }
        }
        cleanup(reason)
    }

    fun setMicEnabled(enabled: Boolean) {
        sfuMedia?.setMicEnabled(enabled)
        rtc?.setMicEnabled(enabled)
        _state.value = _state.value.copy(micEnabled = enabled)
    }

    fun setCamEnabled(enabled: Boolean) {
        sfuMedia?.setCamEnabled(enabled)
        rtc?.setCamEnabled(enabled)
        _state.value = _state.value.copy(camEnabled = enabled, video = enabled || _state.value.video)
    }

    private suspend fun handleRemoteSignal(
        callId: String,
        signalType: String,
        ciphertext: String,
        from: String,
    ) {
        if (signalType == "hangup") {
            cleanup("ended")
            return
        }
        val plain = signal.decrypt(ciphertext, from)
        val payload = JSONObject(plain)
        when (signalType) {
            "offer" -> {
                val sdpObj = payload.optJSONObject("sdp") ?: payload
                pendingOffer = sdpObj.toSessionDescription()
                if (_state.value.status == "idle" || _state.value.status == "incoming") {
                    _state.value = _state.value.copy(
                        status = "incoming",
                        callId = callId,
                        peerId = from,
                        mode = "mesh",
                        incoming = IncomingCall(
                            callId = callId,
                            fromUserId = from,
                            conversationId = _state.value.conversationId,
                            video = _state.value.video,
                        ),
                    )
                }
            }
            "answer" -> {
                val sdpObj = payload.optJSONObject("sdp") ?: payload
                rtc?.setRemoteAnswer(sdpObj.toSessionDescription())
                _state.value = _state.value.copy(status = "connected")
            }
            "ice" -> {
                val candObj = payload.optJSONObject("candidate") ?: payload
                val cand = candObj.toIceCandidate()
                if (rtc == null) {
                    pendingIce.add(cand)
                } else {
                    rtc?.addIce(cand)
                }
            }
        }
    }

    private fun createRtc(
        ice: List<org.webrtc.PeerConnection.IceServer>,
        video: Boolean,
    ): WebRtcCallSession {
        return WebRtcCallSession(
            context = context,
            iceServers = ice,
            enableVideo = video,
            onLocalIce = { cand ->
                val callId = _state.value.callId ?: return@WebRtcCallSession
                val peer = _state.value.peerId ?: return@WebRtcCallSession
                scope.launch(Dispatchers.IO) {
                    try {
                        relay(callId, peer, "ice", JSONObject().put("candidate", cand.toJson()))
                    } catch (e: Exception) {
                        Log.w(TAG, "ice send: ${e.message}")
                    }
                }
            },
            onRemoteTrack = { kind ->
                _state.value = _state.value.copy(
                    status = "connected",
                    remoteAudio = _state.value.remoteAudio || kind == "audio",
                    remoteVideo = _state.value.remoteVideo || kind == "video",
                )
            },
            onState = { name ->
                if (name.equals("CONNECTED", true)) {
                    _state.value = _state.value.copy(status = "connected")
                } else if (name.equals("FAILED", true)) {
                    _state.value = _state.value.copy(status = "ended", error = "connection_failed")
                }
            },
        )
    }

    private fun relay(callId: String, peerId: String, type: String, body: JSONObject) {
        try {
            signal.establishWithPeer(peerId)
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        val (ct, protocol) = signal.encrypt(body.toString(), peerId)
        calls.signal(callId, type, ct, protocol)
    }

    private fun cleanup(reason: String) {
        ringJob?.cancel()
        ringJob = null
        try {
            unbindVideoRenderers()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        try {
            sfuMedia?.close()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        sfuMedia = null
        try {
            sfuSession?.close()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        sfuSession = null
        pendingSfuJoin = null
        try {
            rtc?.close()
        } catch (e: Exception) { Log.w(TAG, "swallowed: ${e.message}") }
        rtc = null
        pendingOffer = null
        pendingIce.clear()
        _state.value = UiState(
            status = "idle",
            error = when (reason) {
                "failed" -> "call_failed"
                "missed" -> "no_answer"
                "busy" -> "busy"
                else -> null
            },
        )
    }

    private suspend fun <T> withContextIo(block: () -> T): T =
        kotlinx.coroutines.withContext(Dispatchers.IO) { block() }

    companion object {
        private const val TAG = "CallCoordinator"
        private const val RING_TIMEOUT_MS = 45_000L
    }
}

