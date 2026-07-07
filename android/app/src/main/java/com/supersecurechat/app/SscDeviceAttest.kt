package com.supersecurechat.app

import android.util.Base64
import com.supersecurechat.app.BuildConfig
import java.nio.charset.StandardCharsets
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Play Integrity attestation token builder (Phase 3).
 * Production builds should replace with Google Play Integrity API token exchange.
 */
object SscDeviceAttest {
    const val HEADER = "X-SSC-Device-Attest"

    fun currentToken(): String? {
        val secret = System.getenv("SSC_PLAY_INTEGRITY_SECRET")
        if (secret.isNullOrBlank()) {
            return if (BuildConfig.DEBUG) "ssc-attest-test-v1" else null
        }
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