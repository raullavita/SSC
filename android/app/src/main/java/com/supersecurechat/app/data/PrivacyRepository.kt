package com.supersecurechat.app.data

import android.util.Log
import org.json.JSONObject

class PrivacyRepository(
    private val http: SscHttpClient,
) {
    data class Settings(
        val lastSeenVisible: Boolean = true,
        val readReceipts: Boolean = true,
        val pushRichLabels: Boolean = false,
    )

    fun get(): Settings {
        return try {
            val json = http.requestJson("/api/privacy", "GET")
            val s = json.optJSONObject("privacy_settings") ?: json
            Settings(
                lastSeenVisible = s.optBoolean("last_seen_visible", true),
                readReceipts = s.optBoolean("read_receipts", true),
                pushRichLabels = s.optBoolean("push_rich_labels", false),
            )
        } catch (e: Exception) {
            Log.w(TAG, "get privacy: ${e.message}")
            Settings()
        }
    }

    fun patch(
        lastSeenVisible: Boolean? = null,
        readReceipts: Boolean? = null,
        pushRichLabels: Boolean? = null,
    ): Settings {
        val body = JSONObject()
        if (lastSeenVisible != null) body.put("last_seen_visible", lastSeenVisible)
        if (readReceipts != null) body.put("read_receipts", readReceipts)
        if (pushRichLabels != null) body.put("push_rich_labels", pushRichLabels)
        val json = http.requestJson("/api/privacy", "PATCH", body)
        val s = json.optJSONObject("privacy_settings") ?: json
        return Settings(
            lastSeenVisible = s.optBoolean("last_seen_visible", true),
            readReceipts = s.optBoolean("read_receipts", true),
            pushRichLabels = s.optBoolean("push_rich_labels", false),
        )
    }

    companion object {
        private const val TAG = "PrivacyRepository"
    }
}
