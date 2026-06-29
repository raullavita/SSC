package chat.ssc.secure.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import chat.ssc.secure.R;

/**
 * Optional message notification sound presets — Q.45.
 */
public final class SscNotificationSounds {
    public static final String PREFS = "ssc_notification_sound_v1";
    public static final String KEY_PRESET = "preset";
    public static final String PRESET_DEFAULT = "default";
    public static final String PRESET_SOFT = "soft";
    public static final String PRESET_BRIGHT = "bright";
    public static final String PRESET_SILENT = "silent";

    private SscNotificationSounds() {}

    public static String getPreset(Context context) {
        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String preset = prefs.getString(KEY_PRESET, PRESET_DEFAULT);
        if (preset == null || preset.isEmpty()) return PRESET_DEFAULT;
        return preset;
    }

    public static void setPreset(Context context, String preset) {
        if (!isValidPreset(preset)) preset = PRESET_DEFAULT;
        context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PRESET, preset)
            .apply();
        applyMessageSoundPreset(context, preset);
    }

    public static boolean isValidPreset(String preset) {
        return PRESET_DEFAULT.equals(preset)
            || PRESET_SOFT.equals(preset)
            || PRESET_BRIGHT.equals(preset)
            || PRESET_SILENT.equals(preset);
    }

    public static Uri soundUriForPreset(Context context, String preset) {
        if (PRESET_SILENT.equals(preset)) return null;
        if (PRESET_SOFT.equals(preset)) {
            return Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.ssc_notif_soft);
        }
        if (PRESET_BRIGHT.equals(preset)) {
            return Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.ssc_notif_bright);
        }
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    }

    public static void applySoundToChannel(NotificationChannel channel, Context context, String preset) {
        if (channel == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Uri uri = soundUriForPreset(context, preset);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(uri, attrs);
        channel.enableVibration(!PRESET_SILENT.equals(preset));
    }

    public static void applyMessageSoundPreset(Context context, String preset) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (!isValidPreset(preset)) preset = PRESET_DEFAULT;

        NotificationManager mgr = context.getSystemService(NotificationManager.class);
        if (mgr == null) return;

        NotificationChannel messages = mgr.getNotificationChannel(SscMessageNotification.CHANNEL_ID);
        if (messages == null) {
            messages = new NotificationChannel(
                SscMessageNotification.CHANNEL_ID,
                "Messages",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            messages.setDescription("SSC encrypted messages and alerts");
        }
        applySoundToChannel(messages, context, preset);
        mgr.createNotificationChannel(messages);

        for (NotificationChannel existing : mgr.getNotificationChannels()) {
            if (existing == null || existing.getId() == null) continue;
            if (!existing.getId().startsWith("ssc_chat_")) continue;
            if (existing.getImportance() == NotificationManager.IMPORTANCE_NONE) continue;
            applySoundToChannel(existing, context, preset);
            mgr.createNotificationChannel(existing);
        }
    }
}