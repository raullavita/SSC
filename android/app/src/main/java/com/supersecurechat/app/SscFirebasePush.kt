package com.supersecurechat.app

import android.util.Log
import androidx.activity.ComponentActivity
import com.google.firebase.messaging.FirebaseMessaging

/** Request FCM device token for SSC Installed (com.supersecurechat.app). */
object SscFirebasePush {
    private const val TAG = "SscFirebasePush"

    fun register(activity: ComponentActivity, onToken: (() -> Unit)? = null) {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener(activity) { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "FCM token fetch failed", task.exception)
                    return@addOnCompleteListener
                }
                val token = task.result ?: return@addOnCompleteListener
                SscPushBridge.storeToken(activity.applicationContext, token)
                Log.i(TAG, "FCM token ready")
                onToken?.invoke()
            }
        } catch (error: Throwable) {
            Log.w(TAG, "FCM not available: ${error.message}")
        }
    }
}