package com.supersecurechat.app.data

import org.json.JSONObject
import java.net.URLEncoder

class UserRepository(
    private val http: SscHttpClient,
    private val db: LocalMessageDb,
) {
    data class PublicUser(
        val id: String,
        val username: String?,
        val displayName: String?,
    )

    fun lookup(target: String): PublicUser {
        val encoded = URLEncoder.encode(target.trim().removePrefix("@"), "UTF-8")
        val json = http.requestJson("/api/users/lookup/$encoded", "GET")
        val user = json.optJSONObject("user") ?: json
        val id = user.optString("id", user.optString("_id", ""))
        val username = user.optString("username").ifBlank { null }
        val displayName = user.optString("display_name").ifBlank { null }
        if (id.isNotBlank()) {
            db.putContact(id, username, displayName)
        }
        return PublicUser(id, username, displayName)
    }

    fun setUsername(username: String): PublicUser {
        val json = http.requestJson(
            "/api/users/me/username",
            "PATCH",
            JSONObject().put("username", username.trim()),
        )
        val user = json.optJSONObject("user") ?: json
        return PublicUser(
            id = user.optString("id", user.optString("_id", "")),
            username = user.optString("username").ifBlank { null },
            displayName = user.optString("display_name").ifBlank { null },
        )
    }
}
