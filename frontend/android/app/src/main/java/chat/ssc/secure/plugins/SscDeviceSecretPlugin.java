package chat.ssc.secure.plugins;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hardware-backed device secrets — TASK O.3 (Android Keystore via security-crypto).
 */
@CapacitorPlugin(name = "SscDeviceSecret")
public class SscDeviceSecretPlugin extends Plugin {
    private static final String PREFS_NAME = "ssc_device_secrets_v1";

    private SharedPreferences securePrefs() throws Exception {
        Context ctx = getContext().getApplicationContext();
        MasterKey masterKey = new MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build();
        return EncryptedSharedPreferences.create(
            ctx,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("KEY_REQUIRED");
            return;
        }
        try {
            SharedPreferences prefs = securePrefs();
            String value = prefs.getString(key, null);
            JSObject ret = new JSObject();
            ret.put("value", value);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("GET_FAILED", e);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || key.isEmpty()) {
            call.reject("KEY_REQUIRED");
            return;
        }
        try {
            SharedPreferences prefs = securePrefs();
            prefs.edit().putString(key, value).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("SET_FAILED", e);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("KEY_REQUIRED");
            return;
        }
        try {
            SharedPreferences prefs = securePrefs();
            prefs.edit().remove(key).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("REMOVE_FAILED", e);
        }
    }
}