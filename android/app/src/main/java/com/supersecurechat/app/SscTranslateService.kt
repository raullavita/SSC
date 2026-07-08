package com.supersecurechat.app

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * On-device translation via ML Kit — no text leaves the device.
 */
object SscTranslateService {
    private const val TIMEOUT_SEC = 90L

    fun dispatch(method: String, args: JSONObject): Any {
        return when (method) {
            "translateAvailable" -> JSONObject().put("ok", true)
            "translateAvailability" -> availability(args)
            "translate" -> translate(args)
            else -> throw IllegalArgumentException("unknown_translate_method:$method")
        }
    }

    private fun normalizeLang(code: String?): String? {
        if (code.isNullOrBlank() || code == "auto") return null
        val tag = code.lowercase().take(2)
        return TranslateLanguage.fromLanguageTag(tag)
    }

    private fun availability(args: JSONObject): JSONObject {
        val source = normalizeLang(args.optString("source", "auto"))
            ?: normalizeLang("en")
        val target = normalizeLang(args.getString("target"))
        if (source == null || target == null) {
            return JSONObject().put("status", "unavailable")
        }
        if (source == target) {
            return JSONObject().put("status", "available")
        }
        val supported = TranslateLanguage.getAllLanguages()
        val ok = supported.contains(source) && supported.contains(target)
        return JSONObject().put("status", if (ok) "downloadable" else "unavailable")
    }

    private fun translate(args: JSONObject): JSONObject {
        val text = args.getString("text")
        val source = normalizeLang(args.optString("source", "auto"))
            ?: normalizeLang("en")
            ?: throw IllegalArgumentException("unsupported_source")
        val target = normalizeLang(args.getString("target"))
            ?: throw IllegalArgumentException("unsupported_target")

        if (source == target) {
            return JSONObject()
                .put("text", text)
                .put("source", source)
                .put("target", target)
        }

        val options = TranslatorOptions.Builder()
            .setSourceLanguage(source)
            .setTargetLanguage(target)
            .build()
        val translator = Translation.getClient(options)
        val latch = CountDownLatch(1)
        var translated: String? = null
        var error: String? = null

        val conditions = DownloadConditions.Builder().build()
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                translator.translate(text)
                    .addOnSuccessListener { result ->
                        translated = result
                        latch.countDown()
                    }
                    .addOnFailureListener { failure ->
                        error = failure.message ?: "translate_failed"
                        latch.countDown()
                    }
            }
            .addOnFailureListener { failure ->
                error = failure.message ?: "model_download_failed"
                latch.countDown()
            }

        if (!latch.await(TIMEOUT_SEC, TimeUnit.SECONDS)) {
            throw RuntimeException("translate_timeout")
        }
        if (error != null) {
            throw RuntimeException(error)
        }

        return JSONObject()
            .put("text", translated ?: "")
            .put("source", source)
            .put("target", target)
    }
}