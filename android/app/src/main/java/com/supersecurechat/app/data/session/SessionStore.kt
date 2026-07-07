package com.supersecurechat.app.data.session

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.supersecurechat.app.data.model.User
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore("ssc_session")

class SessionStore(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }

    private val userKey = stringPreferencesKey("user_json")
    private val wsTokenKey = stringPreferencesKey("ws_token")

    val isLoggedIn: Flow<Boolean> = context.sessionDataStore.data.map { prefs ->
        prefs[userKey] != null
    }

    suspend fun currentUser(): User? {
        val raw = context.sessionDataStore.data.first()[userKey] ?: return null
        return runCatching { json.decodeFromString(User.serializer(), raw) }.getOrNull()
    }

    suspend fun wsToken(): String? =
        context.sessionDataStore.data.first()[wsTokenKey]

    suspend fun saveSession(user: User, wsToken: String) {
        context.sessionDataStore.edit { prefs ->
            prefs[userKey] = json.encodeToString(User.serializer(), user)
            prefs[wsTokenKey] = wsToken
        }
    }

    suspend fun clear() {
        context.sessionDataStore.edit { it.clear() }
    }
}