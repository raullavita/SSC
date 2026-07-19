package com.supersecurechat.app

import android.util.Base64
import android.util.Log
import com.supersecurechat.app.BuildConfig
import java.nio.charset.StandardCharsets
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Device attestation header for API gate.
 *
 * Current: HMAC token when `SSC_PLAY_INTEGRITY_SECRET` is set (shared secret).
 * Production hardening path: replace [currentToken] with Google Play Integrity
 * standard request + backend verifyIntegrityToken (Play Integrity API).
 *
 * When secret is blank:
 * - debug builds send a known test token (backend may accept in non-prod)
 * - release builds send no header (server must not require attest until Play Integrity is live)
 */
object SscDeviceAttest {
    const val HEADER = "X-SSC-Device-Attest"
    private const val TAG = "SscDeviceAttest"

    fun currentToken(): String? {
        val secret = BuildConfig.SSC_PLAY_INTEGRITY_SECRET
        if (secret.isNullOrBlank()) {
            return if (BuildConfig.DEBUG) {
                Log.d(TAG, "using debug attest token (no Play Integrity secret)")
                "ssc-attest-test-v1"
            } else {
                null
            }
        }
        // Shared-secret HMAC until Play Integrity is wired end-to-end
        val ts = (System.currentTimeMillis() / 1000L)
        val sig = hmacSha256(secret, "android:$ts")
        return "$ts.$sig"
    }

    private fun hmacSha256(secret: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
        val digest = mac.doFinal(message.toByteArray(StandardCharsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
