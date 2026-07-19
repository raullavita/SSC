package com.supersecurechat.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * On-device message + contact cache for native client (metadata-minimized server still has ciphertext).
 */
class LocalMessageDb(context: Context) : SQLiteOpenHelper(
    context.applicationContext,
    "ssc_native.db",
    null,
    2,
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE messages (
              id TEXT PRIMARY KEY NOT NULL,
              conversation_id TEXT NOT NULL,
              sender_id TEXT,
              ciphertext TEXT,
              protocol TEXT,
              created_at TEXT,
              plaintext TEXT,
              mine INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent(),
        )
        db.execSQL("CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at)")
        db.execSQL(
            """
            CREATE TABLE contacts (
              user_id TEXT PRIMARY KEY NOT NULL,
              username TEXT,
              display_name TEXT
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE conversation_meta (
              conversation_id TEXT PRIMARY KEY NOT NULL,
              peer_id TEXT,
              group_id TEXT,
              title TEXT,
              type TEXT,
              updated_at TEXT,
              unread INTEGER NOT NULL DEFAULT 0,
              pinned INTEGER NOT NULL DEFAULT 0,
              muted INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            try {
                db.execSQL("ALTER TABLE conversation_meta ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
            } catch (_: Exception) {
            }
            try {
                db.execSQL("ALTER TABLE conversation_meta ADD COLUMN muted INTEGER NOT NULL DEFAULT 0")
            } catch (_: Exception) {
            }
        }
    }

    fun upsertMessage(msg: ConversationRepository.Message) {
        val values = ContentValues().apply {
            put("id", msg.id)
            put("conversation_id", msg.conversationId)
            put("sender_id", msg.senderId)
            put("ciphertext", msg.ciphertext)
            put("protocol", msg.protocol)
            put("created_at", msg.createdAt)
            put("plaintext", msg.plaintext)
            put("mine", if (msg.plaintext != null && msg.senderId != null) 0 else 0)
        }
        writableDatabase.insertWithOnConflict("messages", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun listMessages(conversationId: String): List<ConversationRepository.Message> {
        val out = ArrayList<ConversationRepository.Message>()
        readableDatabase.query(
            "messages",
            arrayOf("id", "conversation_id", "sender_id", "ciphertext", "protocol", "created_at", "plaintext"),
            "conversation_id = ?",
            arrayOf(conversationId),
            null,
            null,
            "created_at ASC",
        ).use { c ->
            while (c.moveToNext()) {
                out.add(
                    ConversationRepository.Message(
                        id = c.getString(0),
                        conversationId = c.getString(1),
                        senderId = c.getString(2),
                        ciphertext = c.getString(3),
                        protocol = c.getString(4),
                        createdAt = c.getString(5),
                        plaintext = c.getString(6),
                    ),
                )
            }
        }
        return out
    }

    fun putContact(userId: String, username: String?, displayName: String?) {
        val values = ContentValues().apply {
            put("user_id", userId)
            put("username", username)
            put("display_name", displayName)
        }
        writableDatabase.insertWithOnConflict("contacts", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun contactTitle(userId: String?): String? {
        if (userId.isNullOrBlank()) return null
        readableDatabase.query(
            "contacts",
            arrayOf("display_name", "username", "user_id"),
            "user_id = ?",
            arrayOf(userId),
            null,
            null,
            null,
            "1",
        ).use { c ->
            if (!c.moveToFirst()) return null
            val name = c.getString(0)
            val uname = c.getString(1)
            return when {
                !name.isNullOrBlank() -> name
                !uname.isNullOrBlank() -> "@$uname"
                else -> c.getString(2)
            }
        }
    }

    fun upsertConversation(conv: ConversationRepository.Conversation) {
        val values = ContentValues().apply {
            put("conversation_id", conv.id)
            put("peer_id", conv.peerId)
            put("group_id", conv.groupId)
            put("title", conv.title)
            put("type", conv.type)
            put("updated_at", conv.updatedAt)
            put("unread", conv.unread)
            put("pinned", if (conv.pinned) 1 else 0)
            put("muted", if (conv.muted) 1 else 0)
        }
        writableDatabase.insertWithOnConflict("conversation_meta", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun listConversations(): List<ConversationRepository.Conversation> {
        val out = ArrayList<ConversationRepository.Conversation>()
        readableDatabase.query(
            "conversation_meta",
            arrayOf("conversation_id", "type", "title", "peer_id", "group_id", "updated_at", "unread", "pinned", "muted"),
            null,
            null,
            null,
            null,
            "pinned DESC, updated_at DESC",
        ).use { c ->
            while (c.moveToNext()) {
                out.add(
                    ConversationRepository.Conversation(
                        id = c.getString(0),
                        type = c.getString(1) ?: "direct",
                        title = c.getString(2) ?: "Chat",
                        peerId = c.getString(3),
                        groupId = c.getString(4),
                        updatedAt = c.getString(5),
                        unread = c.getInt(6),
                        pinned = if (c.columnCount > 7) c.getInt(7) == 1 else false,
                        muted = if (c.columnCount > 8) c.getInt(8) == 1 else false,
                    ),
                )
            }
        }
        return out
    }

    fun clearAll() {
        writableDatabase.delete("messages", null, null)
        writableDatabase.delete("contacts", null, null)
        writableDatabase.delete("conversation_meta", null, null)
    }

    fun searchMessages(query: String, limit: Int = 50): List<LocalSearch.Hit> {
        val like = "%$query%"
        val out = ArrayList<LocalSearch.Hit>()
        readableDatabase.query(
            "messages",
            arrayOf("id", "conversation_id", "plaintext"),
            "plaintext LIKE ? AND plaintext IS NOT NULL",
            arrayOf(like),
            null,
            null,
            "created_at DESC",
            limit.toString(),
        ).use { c ->
            while (c.moveToNext()) {
                val plain = c.getString(2) ?: continue
                out.add(
                    LocalSearch.Hit(
                        messageId = c.getString(0),
                        conversationId = c.getString(1),
                        snippet = plain.take(120),
                    ),
                )
            }
        }
        return out
    }

    fun deleteMessage(messageId: String) {
        writableDatabase.delete("messages", "id = ?", arrayOf(messageId))
    }
}
