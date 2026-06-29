package chat.ssc.secure.plugins;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import chat.ssc.secure.MainActivity;
import chat.ssc.secure.push.SscNotificationReplyStore;

/**
 * Bridges Android notification inline-reply queue to the WebView (Q.43).
 */
@CapacitorPlugin(name = "SscNotificationReply")
public class SscNotificationReplyPlugin extends Plugin {
    private static final String EVENT_REPLY = "notificationReply";
    public static Bridge staticBridge = null;

    @Override
    public void load() {
        super.load();
        staticBridge = this.bridge;
        emitStoredPendingReply();
    }

    @PluginMethod
    public void getPendingReply(PluginCall call) {
        SscNotificationReplyStore.PendingReply pending = SscNotificationReplyStore.peek(getContext());
        if (pending == null) {
            call.resolve(emptyReply());
            return;
        }
        call.resolve(toReplyObject(pending.conversationId, pending.text));
    }

    @PluginMethod
    public void clearPendingReply(PluginCall call) {
        SscNotificationReplyStore.clear(getContext());
        call.resolve();
    }

    public static void dispatchPendingReply(Context context, String conversationId, String text) {
        SscNotificationReplyPlugin plugin = getInstance();
        if (plugin != null) {
            plugin.notifyReply(conversationId, text);
            return;
        }
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("ssc_notification_reply", true);
        context.startActivity(launch);
    }

    private void emitStoredPendingReply() {
        SscNotificationReplyStore.PendingReply pending = SscNotificationReplyStore.peek(getContext());
        if (pending != null) {
            notifyReply(pending.conversationId, pending.text);
        }
    }

    private void notifyReply(String conversationId, String text) {
        notifyListeners(EVENT_REPLY, toReplyObject(conversationId, text), true);
    }

    private static JSObject toReplyObject(String conversationId, String text) {
        JSObject ret = new JSObject();
        ret.put("conversationId", conversationId);
        ret.put("text", text);
        return ret;
    }

    private static JSObject emptyReply() {
        JSObject ret = new JSObject();
        ret.put("conversationId", null);
        ret.put("text", null);
        return ret;
    }

    public static SscNotificationReplyPlugin getInstance() {
        if (staticBridge != null && staticBridge.getWebView() != null) {
            PluginHandle handle = staticBridge.getPlugin("SscNotificationReply");
            if (handle == null) return null;
            return (SscNotificationReplyPlugin) handle.getInstance();
        }
        return null;
    }
}