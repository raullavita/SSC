package com.supersecurechat.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.PeerConnection

class CallsRepository(
    private val http: SscHttpClient,
) {
    data class CallSession(
        val id: String,
        val conversationId: String,
        val callerId: String?,
        val calleeId: String?,
        val video: Boolean,
    )

    fun iceServers(): List<PeerConnection.IceServer> {
        val json = http.requestJson("/api/calls/ice-servers", "GET")
        val arr = json.optJSONArray("iceServers")
            ?: json.optJSONArray("ice_servers")
            ?: JSONArray()
        val out = ArrayList<PeerConnection.IceServer>()
        for (i in 0 until arr.length()) {
            val s = arr.getJSONObject(i)
            val urls = s.optJSONArray("urls")
            val urlList = ArrayList<String>()
            if (urls != null) {
                for (j in 0 until urls.length()) urlList.add(urls.getString(j))
            } else {
                s.optString("url").takeIf { it.isNotBlank() }?.let { urlList.add(it) }
            }
            if (urlList.isEmpty()) continue
            val builder = PeerConnection.IceServer.builder(urlList)
            val user = s.optString("username").ifBlank { null }
            val pass = s.optString("credential").ifBlank { s.optString("password").ifBlank { null } }
            if (user != null && pass != null) {
                builder.setUsername(user)
                builder.setPassword(pass)
            }
            out.add(builder.createIceServer())
        }
        if (out.isEmpty()) {
            out.add(
                PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            )
        }
        return out
    }

    fun startCall(
        conversationId: String,
        calleeId: String?,
        video: Boolean = false,
        groupCall: Boolean = false,
    ): Pair<CallSession, Boolean> {
        val body = JSONObject()
            .put("conversation_id", conversationId)
            .put("video", video)
            .put("group_call", groupCall)
        if (!calleeId.isNullOrBlank()) body.put("callee_id", calleeId)
        val json = http.requestJson("/api/calls", "POST", body)
        val c = json.optJSONObject("call") ?: json
        val sfuRequired = json.optBoolean("sfu_required", false) ||
            c.optString("mode") == "sfu"
        return parse(c) to sfuRequired
    }

    fun signal(
        callId: String,
        signalType: String,
        ciphertext: String,
        protocol: String = "signal_v1",
        targetPeerId: String? = null,
    ) {
        val body = JSONObject()
            .put("call_id", callId)
            .put("signal_type", signalType)
            .put("ciphertext", ciphertext)
            .put("protocol", protocol)
        if (!targetPeerId.isNullOrBlank()) body.put("target_peer_id", targetPeerId)
        http.requestJson("/api/calls/signal", "POST", body)
    }

    fun endCall(callId: String, reason: String = "ended") {
        try {
            http.requestJson(
                "/api/calls/$callId/end",
                "POST",
                JSONObject().put("reason", reason),
            )
        } catch (e: Exception) {
            android.util.Log.w("CallsRepository", "endCall: ${e.message}")
        }
    }

    private fun parse(c: JSONObject): CallSession {
        return CallSession(
            id = c.optString("id", c.optString("_id", "")),
            conversationId = c.optString("conversation_id", ""),
            callerId = c.optString("caller_id").ifBlank { null },
            calleeId = c.optString("callee_id").ifBlank { null },
            video = c.optBoolean("video", false),
        )
    }
}
