package chat.ssc.secure.push;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Queues notification inline-reply text until the WebView can encrypt and send (Q.43).
 */
public final class SscNotificationReplyStore {
    private static final String PREFS = "ssc_notification_reply_v1";
    private static final String KEY_CONVERSATION_ID = "conversation_id";
    private static final String KEY_TEXT = "text";
    private static final String KEY_CREATED_AT = "created_at";

    private SscNotificationReplyStore() {}

    public static void save(Context context, String conversationId, String text) {
        if (conversationId == null || conversationId.isEmpty() || text == null || text.isEmpty()) return;
        prefs(context).edit()
            .putString(KEY_CONVERSATION_ID, conversationId)
            .putString(KEY_TEXT, text)
            .putLong(KEY_CREATED_AT, System.currentTimeMillis())
            .apply();
    }

    public static PendingReply peek(Context context) {
        SharedPreferences p = prefs(context);
        String conversationId = p.getString(KEY_CONVERSATION_ID, null);
        String text = p.getString(KEY_TEXT, null);
        if (conversationId == null || text == null) return null;
        return new PendingReply(conversationId, text, p.getLong(KEY_CREATED_AT, 0L));
    }

    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static final class PendingReply {
        public final String conversationId;
        public final String text;
        public final long createdAtMs;

        public PendingReply(String conversationId, String text, long createdAtMs) {
            this.conversationId = conversationId;
            this.text = text;
            this.createdAtMs = createdAtMs;
        }
    }
}