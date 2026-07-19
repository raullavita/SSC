package com.supersecurechat.app.data

import org.json.JSONArray
import org.json.JSONObject

class GroupsRepository(
    private val http: SscHttpClient,
) {
    data class GroupSummary(
        val id: String,
        val conversationId: String?,
        val title: String,
        val memberCount: Int,
    )

    fun createGroup(name: String, memberIds: List<String>): JSONObject {
        val members = JSONArray()
        memberIds.forEach { members.put(it) }
        return http.requestJson(
            "/api/groups",
            "POST",
            JSONObject().put("name", name.trim()).put("member_ids", members),
        )
    }

    fun listGroups(): List<GroupSummary> {
        val json = try {
            http.requestJson("/api/groups", "GET")
        } catch (_: Exception) {
            return emptyList()
        }
        val arr = json.optJSONArray("groups") ?: return emptyList()
        val out = ArrayList<GroupSummary>(arr.length())
        for (i in 0 until arr.length()) {
            val g = arr.getJSONObject(i)
            out.add(
                GroupSummary(
                    id = g.optString("id", g.optString("_id", "")),
                    conversationId = g.optString("conversation_id").ifBlank { null },
                    title = g.optString("title", g.optString("name", "Group")),
                    memberCount = g.optInt("member_count", 0),
                ),
            )
        }
        return out
    }

    data class Member(
        val id: String,
        val username: String?,
        val displayName: String?,
    )

    fun listMembers(groupId: String): List<Member> {
        return try {
            val json = http.requestJson("/api/groups/$groupId/members", "GET")
            val arr = json.optJSONArray("members") ?: return emptyList()
            val out = ArrayList<Member>(arr.length())
            for (i in 0 until arr.length()) {
                val m = arr.getJSONObject(i)
                out.add(
                    Member(
                        id = m.optString("id", m.optString("_id", "")),
                        username = m.optString("username").ifBlank { null },
                        displayName = m.optString("display_name").ifBlank { null },
                    ),
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun leaveGroup(groupId: String) {
        http.requestJson("/api/groups/$groupId/leave", "POST")
    }
}
