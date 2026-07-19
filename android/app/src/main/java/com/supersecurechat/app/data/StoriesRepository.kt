package com.supersecurechat.app.data

import org.json.JSONObject

class StoriesRepository(
    private val http: SscHttpClient,
) {
    data class Story(
        val id: String,
        val authorId: String?,
        val createdAt: String?,
    )

    fun feed(): List<Story> {
        return try {
            val json = http.requestJson("/api/stories/feed", "GET")
            val arr = json.optJSONArray("stories") ?: return emptyList()
            val out = ArrayList<Story>(arr.length())
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                out.add(
                    Story(
                        id = s.optString("id", s.optString("_id", "")),
                        authorId = s.optString("author_id", s.optString("user_id")).ifBlank { null },
                        createdAt = s.optString("created_at").ifBlank { null },
                    ),
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun create(ciphertext: String, protocol: String = "signal_v1") {
        http.requestJson(
            "/api/stories",
            "POST",
            JSONObject().put("ciphertext", ciphertext).put("protocol", protocol),
        )
    }
}
