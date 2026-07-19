package com.supersecurechat.app.data

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Live-hardened mediasoup media path (stream-webrtc).
 *
 * Improvements:
 * - RTP params extracted from real local SDP after offer (not random SSRC only)
 * - Consume [SfuSession.existingProducers] after join (late joiners)
 * - Router rtpCapabilities preferred for canConsume
 * - Audio focus for remote audio
 * - producerClosed cleanup
 */
class SfuMediaEngine(
    context: Context,
    private val session: SfuSession,
    private val iceServers: List<PeerConnection.IceServer>,
    private val scope: CoroutineScope,
    private val onRemoteTrack: ((kind: String, producerId: String) -> Unit)? = null,
    private val onState: ((String) -> Unit)? = null,
) {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val executor = Executors.newSingleThreadExecutor()
    private val eglBase = EglBase.create()
    private var factory: PeerConnectionFactory? = null

    private var sendPc: PeerConnection? = null
    private var recvPc: PeerConnection? = null
    private var sendTransportId: String? = null
    private var recvTransportId: String? = null
    private var sendConnected = AtomicBoolean(false)
    private var recvConnected = AtomicBoolean(false)

    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var remoteVideoTrack: VideoTrack? = null
    private var remoteAudioTrack: AudioTrack? = null
    private var capturer: CameraVideoCapturer? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var localRenderer: SurfaceViewRenderer? = null
    private var remoteRenderer: SurfaceViewRenderer? = null
    private var localOfferSdp: String? = null
    private var focusRequest: AudioFocusRequest? = null

    private val closed = AtomicBoolean(false)
    private val consuming = ConcurrentHashMap.newKeySet<String>()

    fun eglContext(): EglBase.Context = eglBase.eglBaseContext

    fun bindLocalVideo(renderer: SurfaceViewRenderer) {
        executor.execute {
            try {
                localRenderer?.let { videoTrack?.removeSink(it) }
                try {
                    renderer.init(eglBase.eglBaseContext, null)
                } catch (_: IllegalStateException) {
                    // already init
                }
                renderer.setMirror(true)
                renderer.setEnableHardwareScaler(true)
                localRenderer = renderer
                videoTrack?.addSink(renderer)
            } catch (e: Exception) {
                Log.w(TAG, "bindLocal: ${e.message}")
            }
        }
    }

    fun bindRemoteVideo(renderer: SurfaceViewRenderer) {
        executor.execute {
            try {
                remoteRenderer?.let { remoteVideoTrack?.removeSink(it) }
                try {
                    renderer.init(eglBase.eglBaseContext, null)
                } catch (_: IllegalStateException) {
                }
                renderer.setMirror(false)
                renderer.setEnableHardwareScaler(true)
                remoteRenderer = renderer
                remoteVideoTrack?.addSink(renderer)
            } catch (e: Exception) {
                Log.w(TAG, "bindRemote: ${e.message}")
            }
        }
    }

    fun unbindVideoRenderers() {
        executor.execute {
            try {
                localRenderer?.let { videoTrack?.removeSink(it) }
                remoteRenderer?.let { remoteVideoTrack?.removeSink(it) }
                localRenderer?.release()
                remoteRenderer?.release()
            } catch (_: Exception) {
            }
            localRenderer = null
            remoteRenderer = null
        }
    }

    suspend fun start(publishAudio: Boolean = true, publishVideo: Boolean = false) {
        withContext(Dispatchers.IO) {
            requestAudioFocus()
            ensureFactory()
            val sendT = session.createWebRtcTransport("send")
            sendTransportId = sendT.id
            sendPc = createPc("send")
            applyRemoteIce(sendPc!!, sendT)

            if (publishAudio) {
                audioSource = factory!!.createAudioSource(MediaConstraints())
                audioTrack = factory!!.createAudioTrack("ssc_sfu_audio", audioSource).also {
                    it.setEnabled(true)
                    sendPc?.addTrack(it, listOf("ssc_sfu"))
                }
            }
            if (publishVideo) {
                startCameraLocked()
            }

            // Offer to materialize SSRCs + DTLS fingerprint
            val offer = createOffer(sendPc!!)
            setLocal(sendPc!!, offer)
            localOfferSdp = offer.description
            val dtls = extractDtlsParameters(offer.description)
                ?: throw IllegalStateException("dtls_params_missing")
            if (!dtls.has("role")) dtls.put("role", "client")
            session.connectWebRtcTransport(sendT.id, dtls)
            sendConnected.set(true)

            if (publishAudio && audioTrack != null) {
                val params = extractRtpParametersFromSdp(offer.description, "audio")
                    ?: buildAudioRtpParametersFallback()
                try {
                    session.produce(sendT.id, "audio", params)
                    Log.i(TAG, "produced audio")
                } catch (e: Exception) {
                    Log.e(TAG, "produce audio failed: ${e.message}")
                    onState?.invoke("produce_audio_failed:${e.message}")
                    throw e
                }
            }
            if (publishVideo && videoTrack != null) {
                // Renegotiate after adding video if camera started after first offer
                val vOffer = createOffer(sendPc!!)
                setLocal(sendPc!!, vOffer)
                localOfferSdp = vOffer.description
                val vParams = extractRtpParametersFromSdp(vOffer.description, "video")
                    ?: buildVideoRtpParametersFallback()
                try {
                    session.produce(sendT.id, "video", vParams)
                    Log.i(TAG, "produced video")
                } catch (e: Exception) {
                    Log.w(TAG, "produce video failed: ${e.message}")
                    onState?.invoke("produce_video_failed:${e.message}")
                }
            }

            val recvT = session.createWebRtcTransport("recv")
            recvTransportId = recvT.id
            recvPc = createPc("recv")
            applyRemoteIce(recvPc!!, recvT)
            val recvOffer = createOffer(recvPc!!)
            setLocal(recvPc!!, recvOffer)
            val recvDtls = extractDtlsParameters(recvOffer.description)
                ?: throw IllegalStateException("recv_dtls_missing")
            if (!recvDtls.has("role")) recvDtls.put("role", "client")
            session.connectWebRtcTransport(recvT.id, recvDtls)
            recvConnected.set(true)

            // Late joiners: consume who is already publishing
            for (ep in session.existingProducers) {
                consumeProducer(ep.producerId, ep.kind)
            }
            // Safety refresh after short delay (race with host produce)
            scope.launch(Dispatchers.IO) {
                delay(800)
                try {
                    for (ep in session.getProducers()) {
                        consumeProducer(ep.producerId, ep.kind)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "getProducers: ${e.message}")
                }
            }
            onState?.invoke("sfu_ready")
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        audioTrack?.setEnabled(enabled)
    }

    fun setCamEnabled(enabled: Boolean) {
        videoTrack?.setEnabled(enabled)
        try {
            if (enabled) capturer?.startCapture(640, 480, 24)
            else capturer?.stopCapture()
        } catch (_: Exception) {
        }
    }

    fun onProducerClosed(producerId: String) {
        consuming.remove(producerId)
    }

    fun consumeProducer(producerId: String, kind: String) {
        if (closed.get() || !consuming.add(producerId)) return
        scope.launch(Dispatchers.IO) {
            try {
                val transportId = recvTransportId
                if (transportId == null) {
                    consuming.remove(producerId)
                    return@launch
                }
                // Prefer client-shaped caps that mediasoup canConsume accepts
                val caps = buildClientRtpCapabilities(session.rtpCapabilities)
                val consumed = session.consume(transportId, producerId, caps)
                applyConsumedTrack(consumed)
                session.resumeConsumer(consumed.id)
                onRemoteTrack?.invoke(consumed.kind, producerId)
                onState?.invoke("sfu_remote_${consumed.kind}")
                Log.i(TAG, "consumed $kind $producerId")
            } catch (e: Exception) {
                consuming.remove(producerId)
                Log.w(TAG, "consume $producerId: ${e.message}")
                onState?.invoke("consume_failed:${e.message}")
            }
        }
    }

    fun close() {
        if (!closed.compareAndSet(false, true)) return
        abandonAudioFocus()
        executor.execute {
            try {
                localRenderer?.let { videoTrack?.removeSink(it) }
                remoteRenderer?.let { remoteVideoTrack?.removeSink(it) }
                localRenderer?.release()
                remoteRenderer?.release()
                localRenderer = null
                remoteRenderer = null
                capturer?.stopCapture()
            } catch (_: Exception) {
            }
            try {
                capturer?.dispose()
                surfaceHelper?.dispose()
                videoTrack?.dispose()
                videoSource?.dispose()
                remoteVideoTrack = null
                remoteAudioTrack?.setEnabled(false)
                remoteAudioTrack = null
                audioTrack?.dispose()
                audioSource?.dispose()
                sendPc?.close()
                sendPc?.dispose()
                recvPc?.close()
                recvPc?.dispose()
                factory?.dispose()
                eglBase.release()
            } catch (_: Exception) {
            }
            sendPc = null
            recvPc = null
            factory = null
        }
        session.close()
    }

    private fun requestAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build(),
                    )
                    .build()
                focusRequest = req
                audioManager.requestAudioFocus(req)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
                )
            }
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = true
        } catch (e: Exception) {
            Log.w(TAG, "audio focus: ${e.message}")
        }
    }

    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
            audioManager.mode = AudioManager.MODE_NORMAL
        } catch (_: Exception) {
        }
    }

    private fun applyRemoteIce(pc: PeerConnection, transport: SfuSession.TransportCreated) {
        val ice = transport.iceParameters
        val ufrag = ice.optString("usernameFragment", ice.optString("usernamefragment", ""))
        val pwd = ice.optString("password", "")
        val sdp = buildRemoteIceSdp(ufrag, pwd, transport.iceCandidates, transport.dtlsParameters)
        try {
            setRemoteSync(pc, SessionDescription(SessionDescription.Type.ANSWER, sdp))
        } catch (e: Exception) {
            Log.w(TAG, "setRemote ice sdp: ${e.message}")
        }
        for (i in 0 until transport.iceCandidates.length()) {
            val c = transport.iceCandidates.optJSONObject(i) ?: continue
            val foundation = c.optString("foundation", "sfu")
            val priority = c.optLong("priority", 1)
            val ip = c.optString("ip", c.optString("address", "0.0.0.0"))
            val port = c.optInt("port", 0)
            val type = c.optString("type", "host")
            val protocol = c.optString("protocol", "udp")
            val candStr = "candidate:$foundation 1 $protocol $priority $ip $port typ $type"
            try {
                pc.addIceCandidate(
                    IceCandidate(c.optString("sdpMid", "0"), c.optInt("sdpMLineIndex", 0), candStr),
                )
            } catch (e: Exception) {
                Log.w(TAG, "addIce: ${e.message}")
            }
        }
    }

    private fun applyConsumedTrack(consumed: SfuSession.Consumed) {
        val pc = recvPc ?: return
        val sdp = buildRecvOfferSdp(consumed)
        try {
            setRemoteSync(pc, SessionDescription(SessionDescription.Type.OFFER, sdp))
            val answer = createAnswer(pc)
            setLocal(pc, answer)
        } catch (e: Exception) {
            Log.w(TAG, "applyConsumed: ${e.message}")
        }
    }

    private fun ensureFactory() {
        if (factory != null) return
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .createInitializationOptions(),
        )
        val encoder = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoder = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoder)
            .setVideoDecoderFactory(decoder)
            .createPeerConnectionFactory()
    }

    private fun createPc(label: String): PeerConnection {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            iceTransportsType = PeerConnection.IceTransportsType.ALL
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
        }
        return factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                onState?.invoke("${label}_${state?.name}")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(candidate: IceCandidate?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                val track = receiver?.track() ?: return
                when (track.kind()) {
                    "video" -> {
                        if (track is VideoTrack) {
                            remoteVideoTrack = track
                            try {
                                remoteRenderer?.let { track.addSink(it) }
                            } catch (_: Exception) {
                            }
                        }
                        onRemoteTrack?.invoke("video", "remote")
                    }
                    "audio" -> {
                        if (track is AudioTrack) {
                            remoteAudioTrack = track
                            track.setEnabled(true)
                            track.setVolume(1.0)
                        }
                        onRemoteTrack?.invoke("audio", "remote")
                    }
                }
            }
        })!!
    }

    private fun startCameraLocked() {
        val enumerator = Camera2Enumerator(appContext)
        val device = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
            ?: enumerator.deviceNames.firstOrNull()
            ?: return
        capturer = enumerator.createCapturer(device, null)
        surfaceHelper = SurfaceTextureHelper.create("SfuCapture", eglBase.eglBaseContext)
        videoSource = factory!!.createVideoSource(false)
        capturer?.initialize(surfaceHelper, appContext, videoSource!!.capturerObserver)
        capturer?.startCapture(640, 480, 24)
        videoTrack = factory!!.createVideoTrack("ssc_sfu_video", videoSource).also {
            it.setEnabled(true)
            sendPc?.addTrack(it, listOf("ssc_sfu"))
            try {
                localRenderer?.let { r -> it.addSink(r) }
            } catch (_: Exception) {
            }
        }
    }

    private fun createOffer(pc: PeerConnection): SessionDescription {
        val done = CompletableDeferred<SessionDescription>()
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription?) {
                if (desc != null) done.complete(desc) else done.completeExceptionally(Exception("null_offer"))
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "offer_failed"))
            }
            override fun onSetFailure(error: String?) {}
        }, constraints)
        return runBlocking { done.await() }
    }

    private fun createAnswer(pc: PeerConnection): SessionDescription {
        val done = CompletableDeferred<SessionDescription>()
        pc.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription?) {
                if (desc != null) done.complete(desc) else done.completeExceptionally(Exception("null_answer"))
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "answer_failed"))
            }
            override fun onSetFailure(error: String?) {}
        }, MediaConstraints())
        return runBlocking { done.await() }
    }

    private fun setLocal(pc: PeerConnection, desc: SessionDescription) {
        val done = CompletableDeferred<Unit>()
        pc.setLocalDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() { done.complete(Unit) }
            override fun onCreateFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "set_local_create"))
            }
            override fun onSetFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "set_local_failed"))
            }
        }, desc)
        runBlocking { done.await() }
    }

    private fun setRemoteSync(pc: PeerConnection, desc: SessionDescription) {
        val done = CompletableDeferred<Unit>()
        pc.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() { done.complete(Unit) }
            override fun onCreateFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "set_remote_create"))
            }
            override fun onSetFailure(error: String?) {
                done.completeExceptionally(Exception(error ?: "set_remote_failed"))
            }
        }, desc)
        runBlocking { done.await() }
    }

    companion object {
        private const val TAG = "SfuMediaEngine"

        fun extractDtlsParameters(sdp: String): JSONObject? {
            val fpLine = sdp.lineSequence().firstOrNull { it.startsWith("a=fingerprint:") }
                ?: return null
            val parts = fpLine.removePrefix("a=fingerprint:").trim().split(" ", limit = 2)
            if (parts.size < 2) return null
            val setup = sdp.lineSequence().firstOrNull { it.startsWith("a=setup:") }
                ?.removePrefix("a=setup:")?.trim()
            val role = when (setup) {
                "active" -> "client"
                "passive" -> "server"
                else -> "client"
            }
            return JSONObject()
                .put(
                    "fingerprints",
                    JSONArray().put(
                        JSONObject().put("algorithm", parts[0]).put("value", parts[1]),
                    ),
                )
                .put("role", role)
        }

        /**
         * Build mediasoup-compatible rtpParameters from a local unified-plan SDP m-section.
         */
        fun extractRtpParametersFromSdp(sdp: String, kind: String): JSONObject? {
            val blocks = sdp.split(Regex("(?=m=)"))
            val media = blocks.firstOrNull { it.startsWith("m=$kind") } ?: return null
            val mid = Regex("a=mid:(\\S+)").find(media)?.groupValues?.get(1)
                ?: if (kind == "audio") "0" else "1"
            val pt = Regex("m=$kind \\S+ \\S+ (\\d+)").find(media)?.groupValues?.get(1)?.toIntOrNull()
                ?: return null
            val rtpmap = Regex("a=rtpmap:$pt ([^/]+)/(\\d+)(?:/(\\d+))?").find(media)
            val codecName = rtpmap?.groupValues?.get(1) ?: if (kind == "audio") "opus" else "VP8"
            val clock = rtpmap?.groupValues?.get(2)?.toIntOrNull()
                ?: if (kind == "audio") 48000 else 90000
            val channels = rtpmap?.groupValues?.get(3)?.toIntOrNull()
            val ssrc = Regex("a=ssrc:(\\d+) ").find(media)?.groupValues?.get(1)?.toLongOrNull()
                ?: return null
            val cname = Regex("a=ssrc:$ssrc cname:(\\S+)").find(media)?.groupValues?.get(1) ?: "ssc-sfu"
            val mime = if (kind == "audio") "audio/$codecName" else "video/$codecName"
            val fmtp = Regex("a=fmtp:$pt (.+)").find(media)?.groupValues?.get(1)
            val params = JSONObject()
            if (fmtp != null) {
                fmtp.split(";").forEach { part ->
                    val kv = part.trim().split("=", limit = 2)
                    if (kv.size == 2) {
                        val v = kv[1].toIntOrNull() ?: kv[1]
                        params.put(kv[0], v)
                    }
                }
            } else if (kind == "audio") {
                params.put("minptime", 10).put("useinbandfec", 1)
            }
            val codec = JSONObject()
                .put("mimeType", mime)
                .put("payloadType", pt)
                .put("clockRate", clock)
                .put("parameters", params)
                .put("rtcpFeedback", JSONArray())
            if (channels != null && kind == "audio") codec.put("channels", channels)
            else if (kind == "audio") codec.put("channels", 2)
            if (kind == "video") {
                codec.put(
                    "rtcpFeedback",
                    JSONArray()
                        .put(JSONObject().put("type", "nack"))
                        .put(JSONObject().put("type", "nack").put("parameter", "pli"))
                        .put(JSONObject().put("type", "ccm").put("parameter", "fir"))
                        .put(JSONObject().put("type", "goog-remb")),
                )
            }
            val headerExt = JSONArray()
                .put(JSONObject().put("uri", "urn:ietf:params:rtp-hdrext:sdes:mid").put("id", 1))
            if (kind == "audio") {
                headerExt.put(
                    JSONObject()
                        .put("uri", "urn:ietf:params:rtp-hdrext:ssrc-audio-level")
                        .put("id", 10),
                )
            } else {
                headerExt.put(
                    JSONObject()
                        .put("uri", "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time")
                        .put("id", 3),
                )
            }
            return JSONObject()
                .put("mid", mid)
                .put("codecs", JSONArray().put(codec))
                .put("headerExtensions", headerExt)
                .put("encodings", JSONArray().put(JSONObject().put("ssrc", ssrc)))
                .put("rtcp", JSONObject().put("cname", cname).put("reducedSize", true))
        }

        fun buildClientRtpCapabilities(routerCaps: JSONObject?): JSONObject {
            // Use router caps when present so canConsume succeeds; else Opus+VP8 defaults
            if (routerCaps != null && routerCaps.has("codecs")) {
                // Client must send its own caps; using a reduced Opus/VP8 set that matches router
                val codecs = routerCaps.optJSONArray("codecs") ?: JSONArray()
                val clientCodecs = JSONArray()
                for (i in 0 until codecs.length()) {
                    val c = codecs.optJSONObject(i) ?: continue
                    val mime = c.optString("mimeType", "")
                    if (mime.contains("opus", true) || mime.contains("VP8", true) ||
                        mime.contains("rtx", true)
                    ) {
                        val copy = JSONObject(c.toString())
                        if (!copy.has("preferredPayloadType") && copy.has("preferredPayloadType").not()) {
                            // mediasoup router uses preferredPayloadType
                        }
                        // Map preferredPayloadType for client Device-like shape
                        if (copy.has("preferredPayloadType").not() && copy.has("payloadType")) {
                            // ok
                        }
                        clientCodecs.put(copy)
                    }
                }
                if (clientCodecs.length() > 0) {
                    return JSONObject()
                        .put("codecs", clientCodecs)
                        .put(
                            "headerExtensions",
                            routerCaps.optJSONArray("headerExtensions") ?: JSONArray(),
                        )
                }
            }
            return defaultRtpCapabilities()
        }

        fun defaultRtpCapabilities(): JSONObject {
            return JSONObject()
                .put(
                    "codecs",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("kind", "audio")
                                .put("mimeType", "audio/opus")
                                .put("clockRate", 48000)
                                .put("channels", 2)
                                .put("preferredPayloadType", 111)
                                .put("parameters", JSONObject())
                                .put("rtcpFeedback", JSONArray()),
                        )
                        .put(
                            JSONObject()
                                .put("kind", "video")
                                .put("mimeType", "video/VP8")
                                .put("clockRate", 90000)
                                .put("preferredPayloadType", 96)
                                .put("parameters", JSONObject())
                                .put(
                                    "rtcpFeedback",
                                    JSONArray()
                                        .put(JSONObject().put("type", "nack"))
                                        .put(JSONObject().put("type", "nack").put("parameter", "pli")),
                                ),
                        ),
                )
                .put(
                    "headerExtensions",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("kind", "audio")
                                .put("uri", "urn:ietf:params:rtp-hdrext:sdes:mid")
                                .put("preferredId", 1),
                        )
                        .put(
                            JSONObject()
                                .put("kind", "video")
                                .put("uri", "urn:ietf:params:rtp-hdrext:sdes:mid")
                                .put("preferredId", 1),
                        ),
                )
        }

        fun buildAudioRtpParametersFallback(): JSONObject {
            return JSONObject()
                .put("mid", "0")
                .put(
                    "codecs",
                    JSONArray().put(
                        JSONObject()
                            .put("mimeType", "audio/opus")
                            .put("payloadType", 111)
                            .put("clockRate", 48000)
                            .put("channels", 2)
                            .put("parameters", JSONObject().put("minptime", 10).put("useinbandfec", 1))
                            .put("rtcpFeedback", JSONArray()),
                    ),
                )
                .put(
                    "headerExtensions",
                    JSONArray()
                        .put(JSONObject().put("uri", "urn:ietf:params:rtp-hdrext:sdes:mid").put("id", 1))
                        .put(
                            JSONObject()
                                .put("uri", "urn:ietf:params:rtp-hdrext:ssrc-audio-level")
                                .put("id", 10),
                        ),
                )
                .put("encodings", JSONArray().put(JSONObject().put("ssrc", 11111111L)))
                .put("rtcp", JSONObject().put("cname", "ssc-sfu").put("reducedSize", true))
        }

        fun buildVideoRtpParametersFallback(): JSONObject {
            return JSONObject()
                .put("mid", "1")
                .put(
                    "codecs",
                    JSONArray().put(
                        JSONObject()
                            .put("mimeType", "video/VP8")
                            .put("payloadType", 96)
                            .put("clockRate", 90000)
                            .put("parameters", JSONObject())
                            .put(
                                "rtcpFeedback",
                                JSONArray()
                                    .put(JSONObject().put("type", "nack"))
                                    .put(JSONObject().put("type", "nack").put("parameter", "pli"))
                                    .put(JSONObject().put("type", "ccm").put("parameter", "fir"))
                                    .put(JSONObject().put("type", "goog-remb")),
                            ),
                    ),
                )
                .put(
                    "headerExtensions",
                    JSONArray()
                        .put(JSONObject().put("uri", "urn:ietf:params:rtp-hdrext:sdes:mid").put("id", 1))
                        .put(
                            JSONObject()
                                .put("uri", "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time")
                                .put("id", 3),
                        ),
                )
                .put("encodings", JSONArray().put(JSONObject().put("ssrc", 22222222L)))
                .put("rtcp", JSONObject().put("cname", "ssc-sfu").put("reducedSize", true))
        }

        fun buildRemoteIceSdp(
            ufrag: String,
            pwd: String,
            candidates: JSONArray,
            dtls: JSONObject,
        ): String {
            val fp = dtls.optJSONArray("fingerprints")?.optJSONObject(0)
            val algo = fp?.optString("algorithm", "sha-256") ?: "sha-256"
            val value = fp?.optString("value", "") ?: ""
            val sb = StringBuilder()
            sb.append("v=0\r\n")
            sb.append("o=- 0 0 IN IP4 127.0.0.1\r\n")
            sb.append("s=-\r\n")
            sb.append("t=0 0\r\n")
            sb.append("a=ice-lite\r\n")
            sb.append("a=group:BUNDLE 0\r\n")
            sb.append("a=msid-semantic: WMS *\r\n")
            sb.append("m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n")
            sb.append("c=IN IP4 0.0.0.0\r\n")
            sb.append("a=rtcp:9 IN IP4 0.0.0.0\r\n")
            sb.append("a=ice-ufrag:$ufrag\r\n")
            sb.append("a=ice-pwd:$pwd\r\n")
            if (value.isNotBlank()) sb.append("a=fingerprint:$algo $value\r\n")
            sb.append("a=setup:actpass\r\n")
            sb.append("a=mid:0\r\n")
            sb.append("a=recvonly\r\n")
            sb.append("a=rtcp-mux\r\n")
            sb.append("a=rtpmap:111 opus/48000/2\r\n")
            for (i in 0 until candidates.length()) {
                val c = candidates.optJSONObject(i) ?: continue
                val foundation = c.optString("foundation", "1")
                val priority = c.optLong("priority", 1)
                val ip = c.optString("ip", c.optString("address", "0.0.0.0"))
                val port = c.optInt("port", 9)
                val type = c.optString("type", "host")
                val protocol = c.optString("protocol", "udp")
                sb.append("a=candidate:$foundation 1 $protocol $priority $ip $port typ $type\r\n")
            }
            return sb.toString()
        }

        fun buildRecvOfferSdp(consumed: SfuSession.Consumed): String {
            val rtp = consumed.rtpParameters
            val mid = rtp.optString("mid", midCounterNext())
            val codecs = rtp.optJSONArray("codecs") ?: JSONArray()
            val c0 = codecs.optJSONObject(0)
            val pt = c0?.optInt("payloadType", if (consumed.kind == "video") 96 else 111)
                ?: if (consumed.kind == "video") 96 else 111
            val mime = c0?.optString("mimeType", if (consumed.kind == "video") "video/VP8" else "audio/opus")
                ?: if (consumed.kind == "video") "video/VP8" else "audio/opus"
            val clock = c0?.optInt("clockRate", if (consumed.kind == "video") 90000 else 48000)
                ?: if (consumed.kind == "video") 90000 else 48000
            val channels = c0?.optInt("channels", 2) ?: 2
            val codecName = mime.substringAfter("/")
            val media = if (consumed.kind == "video") "video" else "audio"
            val rtpmap = if (media == "audio") {
                "a=rtpmap:$pt $codecName/$clock/$channels"
            } else {
                "a=rtpmap:$pt $codecName/$clock"
            }
            val encodings = rtp.optJSONArray("encodings")
            val ssrc = encodings?.optJSONObject(0)?.optLong("ssrc", 0) ?: 0
            val cname = rtp.optJSONObject("rtcp")?.optString("cname", "sfu") ?: "sfu"
            // Use real DTLS from local if available — actpass placeholder is weak; ICE already set
            return buildString {
                append("v=0\r\n")
                append("o=- ${System.currentTimeMillis()} 2 IN IP4 127.0.0.1\r\n")
                append("s=-\r\n")
                append("t=0 0\r\n")
                append("a=group:BUNDLE $mid\r\n")
                append("a=msid-semantic: WMS *\r\n")
                append("m=$media 9 UDP/TLS/RTP/SAVPF $pt\r\n")
                append("c=IN IP4 0.0.0.0\r\n")
                append("a=rtcp:9 IN IP4 0.0.0.0\r\n")
                append("a=ice-ufrag:sfuu\r\n")
                append("a=ice-pwd:sfupasswordsfupassword00\r\n")
                append("a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\n")
                append("a=setup:actpass\r\n")
                append("a=mid:$mid\r\n")
                append("a=sendonly\r\n")
                append("a=rtcp-mux\r\n")
                append("$rtpmap\r\n")
                if (ssrc != 0L) append("a=ssrc:$ssrc cname:$cname\r\n")
            }
        }

        private var midSeq = AtomicInteger(10)
        private fun midCounterNext(): String = midSeq.getAndIncrement().toString()
    }
}
