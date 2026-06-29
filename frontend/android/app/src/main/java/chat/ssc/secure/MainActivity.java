package chat.ssc.secure;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

import chat.ssc.secure.push.SscNotificationSounds;
import chat.ssc.secure.plugins.SscDeviceSecretPlugin;
import chat.ssc.secure.plugins.SscLibsignalPlugin;
import chat.ssc.secure.plugins.SscMediaPermissionsPlugin;
import chat.ssc.secure.plugins.SscNotificationChannelsPlugin;
import chat.ssc.secure.plugins.SscNotificationReplyPlugin;
import chat.ssc.secure.plugins.SscTranslatePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SscLibsignalPlugin.class);
        registerPlugin(SscDeviceSecretPlugin.class);
        registerPlugin(SscTranslatePlugin.class);
        registerPlugin(SscMediaPermissionsPlugin.class);
        registerPlugin(SscNotificationReplyPlugin.class);
        registerPlugin(SscNotificationChannelsPlugin.class);
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        applySystemBarColors();
        createNotificationChannels();
    }

    private void applySystemBarColors() {
        Window window = getWindow();
        if (window == null) return;
        window.setStatusBarColor(Color.parseColor("#0A0A0A"));
        window.setNavigationBarColor(Color.parseColor("#0A0A0A"));
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightStatusBars(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightNavigationBars(false);
        }
    }

    /** Required for OAuth deep links when launchMode=singleTask (app already running). */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMixedContentMode(
                WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = getSystemService(NotificationManager.class);
        if (mgr == null) return;

        NotificationChannel messages = new NotificationChannel(
            "ssc_messages",
            "Messages",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        messages.setDescription("SSC encrypted messages and alerts");
        SscNotificationSounds.applySoundToChannel(messages, this, SscNotificationSounds.getPreset(this));

        NotificationChannel calls = new NotificationChannel(
            "ssc_calls",
            "Calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        calls.setDescription("Incoming voice and video calls");
        calls.enableVibration(true);

        mgr.createNotificationChannel(messages);
        mgr.createNotificationChannel(calls);
    }
}