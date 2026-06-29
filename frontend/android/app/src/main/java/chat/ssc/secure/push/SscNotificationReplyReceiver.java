package chat.ssc.secure.push;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import chat.ssc.secure.plugins.SscNotificationReplyPlugin;

/**
 * Handles inline reply from message notifications — queues text for JS encryption (Q.43).
 */
public class SscNotificationReplyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!SscMessageNotification.REPLY_ACTION.equals(intent.getAction())) return;

        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) return;

        CharSequence replyText = remoteInput.getCharSequence(SscMessageNotification.REMOTE_INPUT_KEY);
        if (replyText == null || replyText.toString().trim().isEmpty()) return;

        String conversationId = intent.getStringExtra(SscMessageNotification.EXTRA_CONVERSATION_ID);
        if (conversationId == null || conversationId.isEmpty()) return;

        String text = replyText.toString().trim();
        SscNotificationReplyStore.save(context, conversationId, text);

        int notificationId = intent.getIntExtra(SscMessageNotification.EXTRA_NOTIFICATION_ID, -1);
        String tag = intent.getStringExtra(SscMessageNotification.EXTRA_NOTIFICATION_TAG);
        if (notificationId >= 0) {
            NotificationManagerCompat mgr = NotificationManagerCompat.from(context);
            if (tag != null) {
                mgr.cancel(tag, notificationId);
            } else {
                mgr.cancel(notificationId);
            }
        }

        SscNotificationReplyPlugin.dispatchPendingReply(context, conversationId, text);
    }
}