package com.supersecurechat.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM — generic notifications only (no message content; Engine 4 metadata policy).
 * Free path: works with Firebase free tier; no Play Store required for FCM itself.
 */
class SscFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        SscPushBridge.storeToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        ensureChannel()
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "SSC"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: "New activity"
        // Never show ciphertext or previews from data payload.
        val safeBody = if (body.contains("ciphertext", ignoreCase = true)) {
            "New message"
        } else {
            body
        }
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(title)
            .setContentText(safeBody)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "SSC notifications (no message content)"
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val CHANNEL_ID = "ssc_messages"
    }
}
