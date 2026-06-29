package chat.ssc.secure.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import org.json.JSONArray;

/**
 * On-device translation — Engine 9 (Google ML Kit, no server plaintext).
 */
@CapacitorPlugin(name = "SscTranslate")
public class SscTranslatePlugin extends Plugin {

    private static final String PROVIDER = "mlkit_on_device";
    private static final String[] SUPPORTED_LANG_TAGS = {
            "de", "en", "es", "fr", "it", "pt", "ro",
    };

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("on_device", true);
        ret.put("provider", PROVIDER);
        ret.put("requires_model_download", true);
        JSONArray langs = new JSONArray();
        for (String tag : SUPPORTED_LANG_TAGS) {
            langs.put(tag);
        }
        ret.put("languages", langs);
        call.resolve(ret);
    }

    @PluginMethod
    public void translate(PluginCall call) {
        String text = call.getString("text");
        String source = call.getString("source_language");
        String target = call.getString("target_language");
        if (text == null || text.trim().isEmpty()) {
            call.reject("text required");
            return;
        }
        if (target == null || target.trim().isEmpty()) {
            call.reject("target_language required");
            return;
        }

        String sourceLang = resolveLanguage(source, TranslateLanguage.ENGLISH);
        String targetLang = resolveLanguage(target, null);
        if (targetLang == null) {
            call.reject("unsupported target_language: " + target);
            return;
        }
        if (sourceLang.equals(targetLang)) {
            JSObject ret = new JSObject();
            ret.put("translated", text);
            ret.put("provider", PROVIDER);
            ret.put("note", "same language");
            call.resolve(ret);
            return;
        }

        TranslatorOptions options = new TranslatorOptions.Builder()
                .setSourceLanguage(sourceLang)
                .setTargetLanguage(targetLang)
                .build();
        Translator translator = Translation.getClient(options);
        DownloadConditions conditions = new DownloadConditions.Builder().build();

        translator.downloadModelIfNeeded(conditions)
                .addOnSuccessListener(unused -> translator.translate(text)
                        .addOnSuccessListener(translated -> {
                            JSObject ret = new JSObject();
                            ret.put("translated", translated);
                            ret.put("provider", PROVIDER);
                            if (translated != null && translated.equalsIgnoreCase(text)) {
                                ret.put("note", "same language");
                            }
                            call.resolve(ret);
                        })
                        .addOnFailureListener(e -> call.reject("translate failed: " + e.getMessage(), e)))
                .addOnFailureListener(e -> call.reject("model download failed: " + e.getMessage(), e));
    }

    private static String resolveLanguage(String code, String fallback) {
        if (code == null || code.trim().isEmpty()) {
            return fallback;
        }
        String tag = code.toLowerCase().trim().split("-")[0];
        if (!isSupportedTag(tag)) {
            return fallback;
        }
        String mapped = TranslateLanguage.fromLanguageTag(tag);
        if (mapped == null) {
            return fallback;
        }
        return mapped;
    }

    private static boolean isSupportedTag(String tag) {
        for (String supported : SUPPORTED_LANG_TAGS) {
            if (supported.equals(tag)) {
                return true;
            }
        }
        return false;
    }
}