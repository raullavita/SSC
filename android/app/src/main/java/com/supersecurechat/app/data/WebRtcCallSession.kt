package com.supersecurechat.app.data

import android.content.Context
import android.util.Log
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
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 1:1 WebRTC mesh session (audio + optional video). Signaling payloads are
 * E2EE-wrapped by caller via libsignal then posted to /api/calls/signal.
 */
class WebRtcCallSession(
    context: Context,
    private val iceServers: List<PeerConnection.IceServer>,
    private val enableVideo: Boolean = false,
    private val onLocalIce: (IceCandidate) -> Unit,
    private val onRemoteTrack: (kind: String) -> Unit,
    private val onState: (String) -> Unit,
) {
    private val appContext = context.applicationContext
    private val executor = Executors.newSingleThreadExecutor()
    private val eglBase = EglBase.create()
    private var factory: PeerConnectionFactory? = null
    private var pc: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var remoteVideoTrack: VideoTrack? = null
    private var capturer: CameraVideoCapturer? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var localRenderer: SurfaceViewRenderer? = null
    private var remoteRenderer: SurfaceViewRenderer? = null
    private val closed = AtomicBoolean(false)

    fun bindLocalVideo(renderer: SurfaceViewRenderer) {
        executor.execute {
            try {
                localRenderer?.let { videoTrack?.removeSink(it) }
                renderer.init(eglBase.eglBaseContext, null)
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
                renderer.init(eglBase.eglBaseContext, null)
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

    fun startAsCaller(video: Boolean = enableVideo, onLocalOffer: (SessionDescription) -> Unit) {
        executor.execute {
            ensurePc(video)
            val constraints = mediaConstraints(video)
            pc?.createOffer(object : SdpAdapter() {
                override fun onCreateSuccess(desc: SessionDescription?) {
                    if (desc == null) return
                    pc?.setLocalDescription(SdpAdapter(), desc)
                    onLocalOffer(desc)
                }
            }, constraints)
        }
    }

    fun acceptRemoteOffer(
        offer: SessionDescription,
        video: Boolean = enableVideo,
        onLocalAnswer: (SessionDescription) -> Unit,
    ) {
        executor.execute {
            ensurePc(video)
            pc?.setRemoteDescription(SdpAdapter(), offer)
            val constraints = mediaConstraints(video)
            pc?.createAnswer(object : SdpAdapter() {
                override fun onCreateSuccess(desc: SessionDescription?) {
                    if (desc == null) return
                    pc?.setLocalDescription(SdpAdapter(), desc)
                    onLocalAnswer(desc)
                }
            }, constraints)
        }
    }

    fun setRemoteAnswer(answer: SessionDescription) {
        executor.execute {
            pc?.setRemoteDescription(SdpAdapter(), answer)
        }
    }

    fun addIce(candidate: IceCandidate) {
        executor.execute {
            try {
                pc?.addIceCandidate(candidate)
            } catch (e: Exception) {
                Log.w(TAG, "ice: ${e.message}")
            }
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        executor.execute { audioTrack?.setEnabled(enabled) }
    }

    fun setCamEnabled(enabled: Boolean) {
        executor.execute {
            videoTrack?.setEnabled(enabled)
            try {
                if (enabled) capturer?.startCapture(640, 480, 24)
                else capturer?.stopCapture()
            } catch (_: Exception) {
            }
        }
    }

    fun close() {
        if (!closed.compareAndSet(false, true)) return
        executor.execute {
            try {
                unbindVideoRenderers()
                capturer?.stopCapture()
            } catch (_: Exception) {
            }
            try {
                capturer?.dispose()
                surfaceHelper?.dispose()
                videoTrack?.dispose()
                videoSource?.dispose()
                remoteVideoTrack = null
                audioTrack?.dispose()
                audioSource?.dispose()
                pc?.close()
                pc?.dispose()
                factory?.dispose()
                eglBase.release()
            } catch (_: Exception) {
            }
            pc = null
            factory = null
        }
    }

    private fun mediaConstraints(video: Boolean) = MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
        mandatory.add(
            MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (video) "true" else "false"),
        )
    }

    private fun ensurePc(video: Boolean) {
        if (pc != null) return
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
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        pc = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                onState(state?.name ?: "unknown")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(candidate: IceCandidate?) {
                if (candidate != null) onLocalIce(candidate)
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                val track = receiver?.track()
                val kind = track?.kind() ?: "audio"
                if (kind == "video" && track is VideoTrack) {
                    remoteVideoTrack = track
                    try {
                        remoteRenderer?.let { track.addSink(it) }
                    } catch (_: Exception) {
                    }
                }
                onRemoteTrack(kind)
            }
        })
        audioSource = factory!!.createAudioSource(MediaConstraints())
        audioTrack = factory!!.createAudioTrack("ssc_audio", audioSource)
        pc?.addTrack(audioTrack, listOf("ssc_stream"))
        if (video) {
            startCamera()
        }
    }

    private fun startCamera() {
        try {
            val enumerator = Camera2Enumerator(appContext)
            val device = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
                ?: enumerator.deviceNames.firstOrNull()
                ?: return
            capturer = enumerator.createCapturer(device, null)
            surfaceHelper = SurfaceTextureHelper.create("SscCapture", eglBase.eglBaseContext)
            videoSource = factory!!.createVideoSource(false)
            capturer?.initialize(surfaceHelper, appContext, videoSource!!.capturerObserver)
            capturer?.startCapture(640, 480, 24)
            videoTrack = factory!!.createVideoTrack("ssc_video", videoSource)
            pc?.addTrack(videoTrack, listOf("ssc_stream"))
            try {
                localRenderer?.let { videoTrack?.addSink(it) }
            } catch (_: Exception) {
            }
        } catch (e: Exception) {
            Log.w(TAG, "camera: ${e.message}")
        }
    }

    open class SdpAdapter : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String?) {
            Log.w(TAG, "sdp create: $error")
        }
        override fun onSetFailure(error: String?) {
            Log.w(TAG, "sdp set: $error")
        }
    }

    companion object {
        private const val TAG = "WebRtcCall"
    }
}

fun SessionDescription.toJson(): JSONObject =
    JSONObject().put("type", type.canonicalForm()).put("sdp", description)

fun IceCandidate.toJson(): JSONObject =
    JSONObject()
        .put("sdpMid", sdpMid)
        .put("sdpMLineIndex", sdpMLineIndex)
        .put("candidate", sdp)

fun JSONObject.toSessionDescription(): SessionDescription {
    val type = SessionDescription.Type.fromCanonicalForm(getString("type"))
    return SessionDescription(type, getString("sdp"))
}

fun JSONObject.toIceCandidate(): IceCandidate =
    IceCandidate(
        optString("sdpMid", "0"),
        optInt("sdpMLineIndex", 0),
        getString("candidate"),
    )
