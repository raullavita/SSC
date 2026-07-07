package com.supersecurechat.app.ui.navigation

object Routes {
    const val Splash = "splash"
    const val Login = "login"
    const val Register = "register"
    const val Chats = "chats"
    const val Chat = "chat/{conversationId}"

    fun chat(conversationId: String): String = "chat/$conversationId"
}