package com.supersecurechat.app.data

import org.json.JSONObject

class DevicesRepository(
    private val http: SscHttpClient,
    private val session: SessionStore,
) {
    data class Device(
        val deviceId: String,
        val name: String,
        val platform: String,
        val lastActive: String?,
    )

    fun registerThisDevice(name: String = "Android") {
        http.requestJson(
            "/api/devices",
            "POST",
            JSONObject()
                .put("device_id", session.deviceId)
                .put("name", name)
                .put("platform", "android"),
        )
    }

    fun list(): List<Device> {
        val json = http.requestJson("/api/devices", "GET")
        val arr = json.optJSONArray("devices") ?: return emptyList()
        val out = ArrayList<Device>(arr.length())
        for (i in 0 until arr.length()) {
            val d = arr.getJSONObject(i)
            out.add(
                Device(
                    deviceId = d.optString("device_id", d.optString("id", "")),
                    name = d.optString("name", "Device"),
                    platform = d.optString("platform", ""),
                    lastActive = d.optString("last_active").ifBlank { null },
                ),
            )
        }
        return out
    }

    fun revoke(deviceId: String) {
        http.requestJson("/api/devices/$deviceId", "DELETE")
    }

    data class LinkToken(
        val token: String,
        val deepLink: String,
        val expiresInSeconds: Int,
    )

    fun createLinkToken(deviceName: String = "New device"): LinkToken {
        val json = http.requestJson(
            "/api/devices/link",
            "POST",
            JSONObject().put("device_name", deviceName),
        )
        return LinkToken(
            token = json.getString("link_token"),
            deepLink = json.optString("deep_link", "ssc://link-device?token=${json.getString("link_token")}"),
            expiresInSeconds = json.optInt("expires_in_seconds", 600),
        )
    }

    fun confirmLink(linkToken: String, name: String = "Android linked") {
        val json = http.requestJson(
            "/api/devices/link/confirm",
            "POST",
            JSONObject()
                .put("link_token", linkToken)
                .put("name", name)
                .put("platform", "android")
                .put("device_id", session.deviceId.takeIf { it != "1" }),
        )
        // Server may allocate a new device id for secondary devices
        val device = json.optJSONObject("device")
        val newId = device?.optString("device_id")?.ifBlank { null }
        if (!newId.isNullOrBlank()) {
            session.setLinkedDeviceId(newId)
        }
    }
}
