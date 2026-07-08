package com.supersecurechat.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Refreshed FCM tokens — generic notifications only (no message content). */
class SscFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        SscPushBridge.storeToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // System tray handles display; payload stays generic per Engine 4 policy.
    }
}