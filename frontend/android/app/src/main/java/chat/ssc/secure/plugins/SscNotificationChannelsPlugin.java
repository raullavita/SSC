package chat.ssc.secure.plugins;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import chat.ssc.secure.push.SscConversationChannels;

/**
 * Capacitor bridge for per-chat Android notification channels — Q.44.
 */
@CapacitorPlugin(name = "SscNotificationChannels")
public class SscNotificationChannelsPlugin extends Plugin {

    @PluginMethod
    public void ensureConversationChannel(PluginCall call) {
        String conversationId = call.getString("conversationId");
        if (conversationId == null || conversationId.isEmpty()) {
            call.reject("CONVERSATION_ID_REQUIRED");
            return;
        }
        SscConversationChannels.ensureChannel(getContext(), conversationId);
        call.resolve();
    }

    @PluginMethod
    public void setConversationChannelMuted(PluginCall call) {
        String conversationId = call.getString("conversationId");
        if (conversationId == null || conversationId.isEmpty()) {
            call.reject("CONVERSATION_ID_REQUIRED");
            return;
        }
        Boolean muted = call.getBoolean("muted", false);
        SscConversationChannels.setChannelMuted(getContext(), conversationId, Boolean.TRUE.equals(muted));
        call.resolve();
    }
}