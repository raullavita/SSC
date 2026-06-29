package chat.ssc.secure.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Per-conversation Android notification channels (opaque ids — Q.44).
 */
public final class SscConversationChannels {
    private static final String CHANNEL_PREFIX = "ssc_chat_";

    private SscConversationChannels() {}

    public static String channelIdForConversation(String conversationId) {
        if (conversationId == null || conversationId.isEmpty()) {
            return SscMessageNotification.CHANNEL_ID;
        }
        return CHANNEL_PREFIX + digest(conversationId);
    }

    public static void ensureChannel(Context context, String conversationId) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = context.getSystemService(NotificationManager.class);
        if (mgr == null) return;

        String channelId = channelIdForConversation(conversationId);
        NotificationChannel existing = mgr.getNotificationChannel(channelId);
        if (existing != null) return;

        String suffix = digest(conversationId).substring(0, 4);
        NotificationChannel channel = new NotificationChannel(
            channelId,
            "SSC chat · " + suffix,
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Notifications for one SSC chat");
        SscNotificationSounds.applySoundToChannel(channel, context, SscNotificationSounds.getPreset(context));
        mgr.createNotificationChannel(channel);
    }

    public static void setChannelMuted(Context context, String conversationId, boolean muted) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = context.getSystemService(NotificationManager.class);
        if (mgr == null) return;

        ensureChannel(context, conversationId);
        String channelId = channelIdForConversation(conversationId);
        NotificationChannel channel = mgr.getNotificationChannel(channelId);
        if (channel == null) return;

        channel.setImportance(
            muted ? NotificationManager.IMPORTANCE_NONE : NotificationManager.IMPORTANCE_DEFAULT
        );
        mgr.createNotificationChannel(channel);
    }

    private static String digest(String conversationId) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(conversationId.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(String.format("%02x", hash[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(conversationId.hashCode());
        }
    }
}