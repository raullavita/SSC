package chat.ssc.secure.push;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Replaces Capacitor MessagingService — adds reply actions on message pushes (Q.43).
 */
public class SscMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        PushNotificationsPlugin.sendRemoteMessage(remoteMessage);

        if (data == null || data.isEmpty()) return;
        String type = data.get("type");
        boolean silent = "1".equals(data.get("silent"));
        if ("message".equals(type) && !silent) {
            SscMessageNotification.show(getApplicationContext(), data);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        PushNotificationsPlugin.onNewToken(token);
    }
}