package chat.ssc.secure.plugins;

import android.os.Build;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * App lock biometric gate — Q.49.
 */
@CapacitorPlugin(name = "SscAppLock")
public class SscAppLockPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        int status = manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
        );
        boolean available = status == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject ret = new JSObject();
        ret.put("available", available);
        ret.put("status", status);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String reason = call.getString("reason", "Unlock SSC");
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("NO_ACTIVITY");
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt prompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        call.reject("AUTH_ERROR", errString.toString());
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        /* keep prompt open */
                    }
                }
        );

        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(reason)
                .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                                | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            builder.setDeviceCredentialAllowed(true);
        }

        activity.runOnUiThread(() -> prompt.authenticate(builder.build()));
    }
}