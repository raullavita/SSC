package com.supersecurechat.app

import org.json.JSONObject
import java.io.File

class SscFileJsonStore(private val file: File) {
    val data: JSONObject = load()

    fun save() {
        file.parentFile?.mkdirs()
        file.writeText(data.toString())
    }

    private fun load(): JSONObject {
        if (!file.exists()) return JSONObject()
        return try {
            JSONObject(file.readText())
        } catch (_: Exception) {
            JSONObject()
        }
    }
}