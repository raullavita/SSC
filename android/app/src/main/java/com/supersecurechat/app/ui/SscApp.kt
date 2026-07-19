package com.supersecurechat.app.ui

import android.content.Intent
import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.supersecurechat.app.data.AuthRepository
import com.supersecurechat.app.data.BackupRepository
import com.supersecurechat.app.data.BroadcastRepository
import com.supersecurechat.app.data.CallCoordinator
import com.supersecurechat.app.data.CallsRepository
import com.supersecurechat.app.data.ChatEventBus
import com.supersecurechat.app.data.ConversationRepository
import com.supersecurechat.app.data.DeepLinkParser
import com.supersecurechat.app.data.DeepLinkRoute
import com.supersecurechat.app.data.DevicesRepository
import com.supersecurechat.app.data.FilesRepository
import com.supersecurechat.app.data.GroupsRepository
import com.supersecurechat.app.data.LocalMessageDb
import com.supersecurechat.app.data.LocalSearch
import com.supersecurechat.app.data.PollsRepository
import com.supersecurechat.app.data.PresenceRepository
import com.supersecurechat.app.data.PrivacyRepository
import com.supersecurechat.app.data.PushRegistrar
import com.supersecurechat.app.data.ReactionsRepository
import com.supersecurechat.app.data.SesameRepository
import com.supersecurechat.app.data.SessionStore
import com.supersecurechat.app.data.SfuRepository
import com.supersecurechat.app.data.SignalMessaging
import com.supersecurechat.app.data.SocialRepository
import com.supersecurechat.app.data.SscHttpClient
import com.supersecurechat.app.data.SscRealtime
import com.supersecurechat.app.data.StoriesRepository
import com.supersecurechat.app.data.UserRepository
import com.supersecurechat.app.ui.auth.LoginScreen
import com.supersecurechat.app.ui.auth.RecoveryScreen
import com.supersecurechat.app.ui.call.CallOverlay
import com.supersecurechat.app.ui.chat.ChatThreadScreen
import com.supersecurechat.app.ui.chat.ConversationListScreen
import com.supersecurechat.app.ui.settings.SettingsScreen
import com.supersecurechat.app.ui.theme.SscTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private sealed class Screen {
    data object Boot : Screen()
    data object Login : Screen()
    data object Recovery : Screen()
    data object Chats : Screen()
    data class Thread(val conversation: ConversationRepository.Conversation) : Screen()
    data object Settings : Screen()
}

@Composable
fun SscApp(pendingIntent: Intent? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val session = remember { SessionStore(context) }
    val http = remember { SscHttpClient(session) }
    val db = remember { LocalMessageDb(context) }
    val auth = remember { AuthRepository(http, session) }
    val sesame = remember { SesameRepository(http, session) }
    val conversations = remember { ConversationRepository(http, db, session, sesame) }
    val users = remember { UserRepository(http, db) }
    val groups = remember { GroupsRepository(http) }
    val reactions = remember { ReactionsRepository(http) }
    val social = remember { SocialRepository(http) }
    val signal = remember { SignalMessaging(context, http, session) }
    val files = remember { FilesRepository(http, signal) }
    val devices = remember { DevicesRepository(http, session) }
    val calls = remember { CallsRepository(http) }
    val presence = remember { PresenceRepository(http) }
    val stories = remember { StoriesRepository(http) }
    val polls = remember { PollsRepository(http) }
    val sfu = remember { SfuRepository(http) }
    val backup = remember { BackupRepository(context, db, session, http) }
    val broadcast = remember { BroadcastRepository(http, signal, conversations) }
    val privacyRepo = remember { PrivacyRepository(http) }
    val search = remember { LocalSearch(db) }
    val realtime = remember { SscRealtime(http, session) }
    val callCoord = remember {
        CallCoordinator(context, calls, signal, scope)
    }
    val chatEvents = remember { ChatEventBus() }
    val callState by callCoord.state.collectAsState()
    val wsState by realtime.connectionState.collectAsState()

    var screen by remember { mutableStateOf<Screen>(Screen.Boot) }
    var listEpoch by remember { mutableStateOf(0) }
    var threadEpoch by remember { mutableStateOf(0) }
    var deepLink by remember { mutableStateOf(DeepLinkParser.parse(pendingIntent)) }

    // Force re-login on 401 (free path: no token refresh server yet)
    LaunchedEffect(Unit) {
        http.onUnauthorized = {
            session.clearSession()
            screen = Screen.Login
        }
    }

    fun startRealtime() {
        val userId = session.userId ?: return
        realtime.setTopics(listOf("user:$userId"))
        realtime.connect()
    }

    fun stopRealtime() {
        realtime.disconnect()
    }

    fun completeLogin() {
        signal.configureLocalIdentity()
        callCoord.setLocalUserId(session.userId)
        scope.launch(Dispatchers.IO) {
            try {
                signal.ensurePrekeysUploaded()
            } catch (e: Exception) {
                Log.w("SscApp", "prekeys: ${e.message}")
            }
            try {
                devices.registerThisDevice()
            } catch (_: Exception) {
            }
            try {
                PushRegistrar.registerIfPossible(context, http, session)
            } catch (_: Exception) {
            }
        }
        startRealtime()
        screen = Screen.Chats
    }

    fun handleDeepLink(route: DeepLinkRoute) {
        when (route) {
            is DeepLinkRoute.GoogleOAuth -> {
                if (!route.error.isNullOrBlank()) {
                    deepLink = null
                    return
                }
                val code = route.oauthCode
                if (code.isNullOrBlank()) {
                    deepLink = null
                    return
                }
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { auth.exchangeGoogleOAuthCode(code) }
                        completeLogin()
                    } catch (e: Exception) {
                        Log.w("SscApp", "oauth: ${e.message}")
                        screen = Screen.Login
                    } finally {
                        deepLink = null
                    }
                }
                return
            }
            is DeepLinkRoute.AddUser -> {
                if (!session.isLoggedIn) return
                scope.launch {
                    try {
                        val conv = withContext(Dispatchers.IO) {
                            val peer = users.lookup(route.username)
                            conversations.createDirect(peer.id)
                        }
                        screen = Screen.Thread(conv)
                    } catch (e: Exception) {
                        Log.w("SscApp", "add: ${e.message}")
                    }
                }
            }
            is DeepLinkRoute.LinkDevice -> {
                if (!route.token.isNullOrBlank()) {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                devices.confirmLink(route.token!!)
                            }
                            screen = Screen.Settings
                        } catch (e: Exception) {
                            Log.w("SscApp", "link: ${e.message}")
                        }
                    }
                } else if (session.isLoggedIn) {
                    screen = Screen.Settings
                }
            }
            is DeepLinkRoute.SafetyVerify -> Unit
        }
        deepLink = null
    }

    fun onLoggedIn() {
        completeLogin()
        deepLink?.let { handleDeepLink(it) }
    }

    DisposableEffect(Unit) {
        val listener = SscRealtime.Listener { type, payload ->
            // Call events (user topic)
            callCoord.onWsEvent(type, payload)
            val openConv = (screen as? Screen.Thread)?.conversation?.id
            chatEvents.onWsEvent(type, payload, openConv)
            when (type) {
                "message", "message_created", "message_edited", "message_deleted" -> {
                    listEpoch++
                    threadEpoch++
                }
                "reaction_added", "reaction_removed" -> threadEpoch++
                "typing" -> {
                    // ChatEventBus drives "typing…" in open thread
                }
                "conversation_updated" -> listEpoch++
                else -> {
                    if (payload.has("message") || payload.optString("event").contains("message")) {
                        listEpoch++
                        threadEpoch++
                    }
                    val nested = payload.optString("type")
                    if (nested.isNotBlank()) {
                        callCoord.onWsEvent(nested, payload)
                        chatEvents.onWsEvent(nested, payload, openConv)
                    }
                }
            }
        }
        realtime.addListener(listener)
        onDispose {
            realtime.removeListener(listener)
            stopRealtime()
        }
    }

    LaunchedEffect(pendingIntent) {
        deepLink = DeepLinkParser.parse(pendingIntent) ?: deepLink
        deepLink?.let { route ->
            if (route is DeepLinkRoute.GoogleOAuth || route is DeepLinkRoute.LinkDevice) {
                handleDeepLink(route)
            }
        }
    }

    LaunchedEffect(Unit) {
        if (!session.isLoggedIn) {
            val dl = deepLink
            if (dl is DeepLinkRoute.GoogleOAuth) {
                handleDeepLink(dl)
            } else {
                screen = Screen.Login
            }
            return@LaunchedEffect
        }
        try {
            withContext(Dispatchers.IO) {
                auth.me()
                signal.configureLocalIdentity()
                try {
                    signal.ensurePrekeysUploaded()
                } catch (_: Exception) {
                }
                try {
                    devices.registerThisDevice()
                } catch (_: Exception) {
                }
                PushRegistrar.registerIfPossible(context, http, session)
            }
            startRealtime()
            screen = Screen.Chats
            deepLink?.let { handleDeepLink(it) }
        } catch (_: Exception) {
            session.clearSession()
            screen = Screen.Login
        }
    }

    LaunchedEffect(session.isLoggedIn, screen) {
        if (!session.isLoggedIn || screen is Screen.Login || screen is Screen.Boot || screen is Screen.Recovery) {
            return@LaunchedEffect
        }
        while (true) {
            withContext(Dispatchers.IO) { presence.heartbeat() }
            kotlinx.coroutines.delay(60_000)
        }
    }

    SscTheme {
        Column(Modifier.fillMaxSize()) {
            CallOverlay(
                state = callState,
                onAnswer = { callCoord.answerIncoming() },
                onDecline = { callCoord.declineIncoming() },
                onHangup = { callCoord.hangup() },
                onToggleMic = { callCoord.setMicEnabled(!callState.micEnabled) },
                onToggleCam = { callCoord.setCamEnabled(!callState.camEnabled) },
                callCoord = callCoord,
            )
            Box(Modifier.weight(1f).fillMaxSize()) {
                when (val s = screen) {
                    Screen.Boot -> Unit
                    Screen.Login -> LoginScreen(
                        auth = auth,
                        onLoggedIn = { onLoggedIn() },
                        onRecovery = { screen = Screen.Recovery },
                    )
                    Screen.Recovery -> RecoveryScreen(
                        auth = auth,
                        onRecovered = { onLoggedIn() },
                        onBack = { screen = Screen.Login },
                    )
                    Screen.Chats -> ConversationListScreen(
                        conversations = conversations,
                        users = users,
                        groups = groups,
                        auth = auth,
                        search = search,
                        social = social,
                        stories = stories,
                        signal = signal,
                        connectionState = wsState,
                        refreshToken = listEpoch,
                        onOpenChat = { conv ->
                            val userId = session.userId
                            if (userId != null) {
                                realtime.setTopics(listOf("user:$userId", "conversation:${conv.id}"))
                            }
                            screen = Screen.Thread(conv)
                        },
                        onSettings = { screen = Screen.Settings },
                        onLoggedOut = {
                            stopRealtime()
                            db.clearAll()
                            screen = Screen.Login
                        },
                        onReconnect = { startRealtime() },
                    )
                    is Screen.Thread -> ChatThreadScreen(
                        conversation = s.conversation,
                        conversations = conversations,
                        signal = signal,
                        session = session,
                        reactions = reactions,
                        files = files,
                        social = social,
                        calls = calls,
                        presence = presence,
                        callCoord = callCoord,
                        polls = polls,
                        sfu = sfu,
                        groups = groups,
                        chatEvents = chatEvents,
                        refreshToken = threadEpoch,
                        onBack = {
                            val userId = session.userId
                            if (userId != null) realtime.setTopics(listOf("user:$userId"))
                            chatEvents.clearTyping()
                            listEpoch++
                            screen = Screen.Chats
                        },
                    )
                    Screen.Settings -> SettingsScreen(
                        session = session,
                        auth = auth,
                        users = users,
                        devices = devices,
                        social = social,
                        signal = signal,
                        db = db,
                        backup = backup,
                        broadcast = broadcast,
                        privacyRepo = privacyRepo,
                        onBack = { screen = Screen.Chats },
                        onPanicDone = {
                            stopRealtime()
                            screen = Screen.Login
                        },
                    )
                }
            }
        }
    }
}
