package com.supersecurechat.app.data.api

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(context: Context) : CookieJar {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val cache = mutableMapOf<String, MutableList<Cookie>>()

    init {
        loadFromDisk()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val host = url.host
        val existing = cache.getOrPut(host) { mutableListOf() }
        cookies.forEach { newCookie ->
            existing.removeAll { it.name == newCookie.name && it.domain == newCookie.domain }
            if (!newCookie.expiresAt.isExpired()) {
                existing.add(newCookie)
            }
        }
        persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val host = url.host
        val cookies = cache[host].orEmpty()
        val valid = cookies.filter { !it.expiresAt.isExpired() && it.matches(url) }
        if (valid.size != cookies.size) {
            cache[host] = valid.toMutableList()
            persist()
        }
        return valid
    }

    @Synchronized
    fun clear() {
        cache.clear()
        prefs.edit().clear().apply()
    }

    private fun loadFromDisk() {
        val raw = prefs.getString(KEY_COOKIES, null) ?: return
        raw.split(SEP_RECORD).forEach { record ->
            if (record.isBlank()) return@forEach
            val cookie = decodeCookie(record) ?: return@forEach
            val host = cookie.domain.removePrefix(".")
            cache.getOrPut(host) { mutableListOf() }.add(cookie)
        }
    }

    private fun persist() {
        val encoded = cache.values
            .flatten()
            .filter { !it.expiresAt.isExpired() }
            .joinToString(SEP_RECORD) { encodeCookie(it) }
        prefs.edit().putString(KEY_COOKIES, encoded).apply()
    }

    private fun encodeCookie(cookie: Cookie): String =
        listOf(
            cookie.name,
            cookie.value,
            cookie.domain,
            cookie.path,
            cookie.expiresAt.toString(),
            cookie.secure.toString(),
            cookie.httpOnly.toString(),
        ).joinToString(SEP_FIELD)

    private fun decodeCookie(record: String): Cookie? {
        val parts = record.split(SEP_FIELD)
        if (parts.size < 7) return null
        return try {
            Cookie.Builder()
                .name(parts[0])
                .value(parts[1])
                .domain(parts[2])
                .path(parts[3])
                .expiresAt(parts[4].toLong())
                .apply {
                    if (parts[5].toBoolean()) secure()
                    if (parts[6].toBoolean()) httpOnly()
                }
                .build()
        } catch (_: Exception) {
            null
        }
    }

    private fun Long.isExpired(): Boolean = this != 0L && this < System.currentTimeMillis()

    companion object {
        private const val PREFS_NAME = "ssc_cookie_jar"
        private const val KEY_COOKIES = "cookies"
        private const val SEP_RECORD = "\n"
        private const val SEP_FIELD = "\t"
    }
}