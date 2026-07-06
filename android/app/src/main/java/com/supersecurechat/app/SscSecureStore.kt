package com.supersecurechat.app

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-GCM encryption for on-disk signal stores — keys in Android Keystore (Phase 2).
 */
object SscSecureStore {
    private const val KEY_ALIAS = "ssc_signal_master_v1"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val ENC_PREFIX = "SSCENC1:"
    private const val GCM_TAG_BITS = 128

    fun readText(file: File): String {
        if (!file.exists()) return ""
        val raw = file.readText()
        if (!raw.startsWith(ENC_PREFIX)) return raw
        val payload = Base64.decode(raw.removePrefix(ENC_PREFIX), Base64.NO_WRAP)
        return String(decrypt(payload), Charsets.UTF_8)
    }

    fun writeText(file: File, plaintext: String) {
        file.parentFile?.mkdirs()
        val encrypted = encrypt(plaintext.toByteArray(Charsets.UTF_8))
        file.writeText(ENC_PREFIX + Base64.encodeToString(encrypted, Base64.NO_WRAP))
    }

    private fun encrypt(plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext)
        return iv + ciphertext
    }

    private fun decrypt(payload: ByteArray): ByteArray {
        if (payload.size < 13) throw IllegalStateException("ssc_encrypted_payload_too_short")
        val iv = payload.copyOfRange(0, 12)
        val ciphertext = payload.copyOfRange(12, payload.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        return cipher.doFinal(ciphertext)
    }

    private fun masterKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existing != null) return existing.secretKey

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }
}