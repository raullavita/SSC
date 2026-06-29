package chat.ssc.secure.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Q.59 — Opt-in crash reporting (Firebase Crashlytics when Firebase is on classpath).
 */
@CapacitorPlugin(name = "SscCrashReporting")
public class SscCrashReportingPlugin extends Plugin {

    private static final String PREFS = "ssc_crash_reporting_v1";
    private static final String KEY_OPT_IN = "opt_in";
    private static final String TAG = "SscCrashReporting";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void applyCollectionEnabled(boolean enabled) {
        try {
            Class<?> clazz = Class.forName("com.google.firebase.crashlytics.FirebaseCrashlytics");
            Object instance = clazz.getMethod("getInstance").invoke(null);
            clazz.getMethod("setCrashlyticsCollectionEnabled", boolean.class).invoke(instance, enabled);
        } catch (Throwable ignored) {
            Log.i(TAG, "Crashlytics not configured — opt-in stored locally only");
        }
    }

    @PluginMethod
    public void setOptIn(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        boolean on = Boolean.TRUE.equals(enabled);
        prefs().edit().putBoolean(KEY_OPT_IN, on).apply();
        applyCollectionEnabled(on);
        JSObject ret = new JSObject();
        ret.put("opt_in", on);
        call.resolve(ret);
    }

    @PluginMethod
    public void recordException(PluginCall call) {
        if (!prefs().getBoolean(KEY_OPT_IN, false)) {
            JSObject ret = new JSObject();
            ret.put("recorded", false);
            ret.put("reason", "opt_out");
            call.resolve(ret);
            return;
        }
        String message = call.getString("message", "unknown");
        String stack = call.getString("stack", "");
        try {
            Class<?> clazz = Class.forName("com.google.firebase.crashlytics.FirebaseCrashlytics");
            Object instance = clazz.getMethod("getInstance").invoke(null);
            Exception wrapped = new Exception(message + "\n" + stack);
            clazz.getMethod("recordException", Throwable.class).invoke(instance, wrapped);
            JSObject ret = new JSObject();
            ret.put("recorded", true);
            ret.put("provider", "crashlytics");
            call.resolve(ret);
            return;
        } catch (Throwable ignored) {
            Log.w(TAG, "Crash report (opt-in): " + message);
        }
        JSObject ret = new JSObject();
        ret.put("recorded", false);
        ret.put("provider", "log_only");
        call.resolve(ret);
    }
}