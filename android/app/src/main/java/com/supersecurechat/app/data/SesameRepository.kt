package com.supersecurechat.app.data

import android.util.Log
import org.json.JSONObject

/** Multi-device decrypt retry / session healing (sesame). */
class SesameRepository(
    private val http: SscHttpClient,
    private val session: SessionStore,
) {
    fun requestRetry(messageId: String, conversationId: String) {
        try {
            http.requestJson(
                "/api/messages/retry-request",
                "POST",
                JSONObject()
                    .put("message_id", messageId)
                    .put("conversation_id", conversationId)
                    .put("requester_device_id", session.deviceId),
            )
        } catch (e: Exception) {
            Log.w(TAG, "retry-request failed: ${e.message}")
        }
    }

    fun resendCiphertext(
        messageId: String,
        deviceCiphertexts: Map<String, String>,
        protocol: String = "signal_v1",
        targetDeviceId: String? = null,
    ) {
        val map = JSONObject()
        deviceCiphertexts.forEach { (k, v) -> map.put(k, v) }
        val body = JSONObject()
            .put("device_ciphertexts", map)
            .put("protocol", protocol)
        if (!targetDeviceId.isNullOrBlank()) body.put("target_device_id", targetDeviceId)
        http.requestJson("/api/messages/$messageId/resend-ciphertext", "POST", body)
    }

    companion object {
        private const val TAG = "SesameRepository"
    }
}
