package com.supersecurechat.app.data

import android.content.Context
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class VoiceNoteRecorder(context: Context) {
    private val appContext = context.applicationContext
    private var recorder: MediaRecorder? = null
    private var outFile: File? = null

    fun start(): File {
        stop()
        val file = File(appContext.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        outFile = file
        val rec = if (Build.VERSION.SDK_INT >= 31) {
            MediaRecorder(appContext)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        rec.setAudioSource(MediaRecorder.AudioSource.MIC)
        rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        rec.setAudioEncodingBitRate(128_000)
        rec.setAudioSamplingRate(44_100)
        rec.setOutputFile(file.absolutePath)
        rec.prepare()
        rec.start()
        recorder = rec
        return file
    }

    fun stop(): File? {
        return try {
            recorder?.apply {
                stop()
                release()
            }
            recorder = null
            outFile
        } catch (_: Exception) {
            recorder?.release()
            recorder = null
            null
        }
    }

    fun isRecording(): Boolean = recorder != null

    companion object {
        fun play(file: File) {
            try {
                MediaPlayer().apply {
                    setDataSource(file.absolutePath)
                    prepare()
                    start()
                    setOnCompletionListener { release() }
                }
            } catch (_: Exception) {
            }
        }
    }
}
