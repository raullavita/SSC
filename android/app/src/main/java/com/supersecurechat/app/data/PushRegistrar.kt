package com.supersecurechat.app.data

import android.content.Context
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import com.supersecurechat.app.SscPushBridge
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Register FCM token with SSC API (native — no WebView). */
object PushRegistrar {
    private const val TAG = "SscPush"

    fun registerIfPossible(context: Context, http: SscHttpClient, session: SessionStore) {
        if (!session.isLoggedIn) return
        try {
            var token = SscPushBridge.getToken(context)
            if (token.isNullOrBlank()) {
                token = Tasks.await(FirebaseMessaging.getInstance().token, 15, TimeUnit.SECONDS)
                if (!token.isNullOrBlank()) {
                    SscPushBridge.storeToken(context, token)
                }
            }
            if (token.isNullOrBlank() || token.length < 10) return
            if (token.startsWith("ssc-electron-")) return
            http.requestJson(
                "/api/push/register",
                "POST",
                JSONObject().put("token", token).put("platform", "android"),
            )
            Log.i(TAG, "push registered")
        } catch (e: Exception) {
            Log.w(TAG, "push register skipped: ${e.message}")
        }
    }
}
