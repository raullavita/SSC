package com.supersecurechat.app.data

import android.util.Base64
import org.json.JSONObject

class FilesRepository(
    private val http: SscHttpClient,
    private val signal: SignalMessaging,
) {
    data class RemoteFile(
        val id: String,
        val mimeHint: String?,
        val sizeBytes: Int,
        val ciphertext: String?,
    )

    fun uploadEncryptedBytes(
        conversationId: String,
        plainBytes: ByteArray,
        mimeHint: String,
    ): RemoteFile {
        val b64 = Base64.encodeToString(plainBytes, Base64.NO_WRAP)
        val enc = signal.encryptFileBytes(b64)
        val json = http.requestJson(
            "/api/files",
            "POST",
            JSONObject()
                .put("conversation_id", conversationId)
                .put("ciphertext", enc)
                .put("protocol", "signal_v1")
                .put("mime_hint", mimeHint),
        )
        val f = json.optJSONObject("file") ?: json
        return parse(f)
    }

    fun download(fileId: String): Pair<RemoteFile, ByteArray?> {
        val json = http.requestJson("/api/files/$fileId", "GET")
        val f = json.optJSONObject("file") ?: json
        val remote = parse(f)
        val plain = remote.ciphertext?.let { signal.decryptFileBytes(it) }
        return remote to plain
    }

    private fun parse(f: JSONObject): RemoteFile {
        return RemoteFile(
            id = f.optString("id", f.optString("_id", "")),
            mimeHint = f.optString("mime_hint").ifBlank { null },
            sizeBytes = f.optInt("size_bytes", 0),
            ciphertext = f.optString("ciphertext").ifBlank { null },
        )
    }
}
