package com.supersecurechat.app.data

import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AES-GCM field encryption for on-device message plaintext cache.
 * Key lives in EncryptedSharedPreferences (Android Keystore-backed MasterKey).
 */
class MessageFieldCrypto(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context.applicationContext,
        "ssc_msg_field_crypto",
        MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val keyBytes: ByteArray by lazy {
        val existing = prefs.getString(KEY_RAW, null)
        if (existing != null) {
            Base64.decode(existing, Base64.NO_WRAP)
        } else {
            val raw = ByteArray(32)
            SecureRandom().nextBytes(raw)
            prefs.edit().putString(KEY_RAW, Base64.encodeToString(raw, Base64.NO_WRAP)).apply()
            raw
        }
    }

    fun seal(plaintext: String?): String? {
        if (plaintext.isNullOrEmpty()) return plaintext
        return try {
            val iv = ByteArray(12)
            SecureRandom().nextBytes(iv)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
            val ct = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
            val out = ByteArray(iv.size + ct.size)
            System.arraycopy(iv, 0, out, 0, iv.size)
            System.arraycopy(ct, 0, out, iv.size, ct.size)
            PREFIX + Base64.encodeToString(out, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.w(TAG, "seal failed: ${e.message}")
            plaintext
        }
    }

    fun open(stored: String?): String? {
        if (stored.isNullOrEmpty()) return stored
        if (!stored.startsWith(PREFIX)) return stored // legacy plaintext row
        return try {
            val raw = Base64.decode(stored.removePrefix(PREFIX), Base64.NO_WRAP)
            if (raw.size < 13) return null
            val iv = raw.copyOfRange(0, 12)
            val ct = raw.copyOfRange(12, raw.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ct), Charsets.UTF_8)
        } catch (e: Exception) {
            Log.w(TAG, "open failed: ${e.message}")
            null
        }
    }

    companion object {
        private const val TAG = "MessageFieldCrypto"
        private const val KEY_RAW = "aes_key_b64"
        private const val PREFIX = "v1:"
    }
}
