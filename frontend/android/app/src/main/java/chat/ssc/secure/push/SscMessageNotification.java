package chat.ssc.secure.push;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import java.util.Map;

import chat.ssc.secure.MainActivity;
import chat.ssc.secure.R;

/**
 * Builds message notifications with inline reply (RemoteInput) — Q.43.
 */
public final class SscMessageNotification {
    public static final String CHANNEL_ID = "ssc_messages";
    public static final String REPLY_ACTION = "chat.ssc.secure.NOTIFICATION_REPLY";
    public static final String REMOTE_INPUT_KEY = "ssc_reply_input";
    public static final String EXTRA_CONVERSATION_ID = "conversation_id";
    public static final String EXTRA_NOTIFICATION_ID = "notification_id";
    public static final String EXTRA_NOTIFICATION_TAG = "notification_tag";

    private SscMessageNotification() {}

    public static void show(Context context, Map<String, String> data) {
        if (context == null || data == null) return;
        String conversationId = data.get("conversation_id");
        if (conversationId == null || conversationId.isEmpty()) return;

        String title = data.containsKey("title") ? data.get("title") : "SSC";
        String body = data.containsKey("body") ? data.get("body") : "New message";
        int notificationId = stableNotificationId(conversationId);
        String tag = conversationId;

        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        tapIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
        PendingIntent tapPending = PendingIntent.getActivity(
            context,
            notificationId,
            tapIntent,
            immutableFlags(PendingIntent.FLAG_UPDATE_CURRENT)
        );

        Intent replyIntent = new Intent(context, SscNotificationReplyReceiver.class);
        replyIntent.setAction(REPLY_ACTION);
        replyIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
        replyIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        replyIntent.putExtra(EXTRA_NOTIFICATION_TAG, tag);

        RemoteInput remoteInput = new RemoteInput.Builder(REMOTE_INPUT_KEY)
            .setLabel("Reply")
            .build();

        PendingIntent replyPending = PendingIntent.getBroadcast(
            context,
            notificationId + 1,
            replyIntent,
            mutableFlags(PendingIntent.FLAG_UPDATE_CURRENT)
        );

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send,
            "Reply",
            replyPending
        )
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_ssc_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(tapPending)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .addAction(replyAction);

        NotificationManager mgr = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) {
            mgr.notify(tag, notificationId, builder.build());
        }
    }

    static int stableNotificationId(String conversationId) {
        return conversationId.hashCode() & 0x7FFFFFFF;
    }

    private static int immutableFlags(int base) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return base | PendingIntent.FLAG_IMMUTABLE;
        }
        return base;
    }

    private static int mutableFlags(int base) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return base | PendingIntent.FLAG_MUTABLE;
        }
        return base;
    }
}