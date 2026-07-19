package com.supersecurechat.app.data

/** Simple local plaintext search over SQLite cache. */
class LocalSearch(
    private val db: LocalMessageDb,
) {
    data class Hit(
        val messageId: String,
        val conversationId: String,
        val snippet: String,
    )

    fun search(query: String, limit: Int = 50): List<Hit> {
        val q = query.trim()
        if (q.length < 2) return emptyList()
        return db.searchMessages(q, limit)
    }
}
