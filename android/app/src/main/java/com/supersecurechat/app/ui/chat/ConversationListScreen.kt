package com.supersecurechat.app.ui.chat

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.supersecurechat.app.data.AuthRepository
import com.supersecurechat.app.data.ConversationRepository
import com.supersecurechat.app.data.GroupsRepository
import com.supersecurechat.app.data.LocalSearch
import com.supersecurechat.app.data.SocialRepository
import com.supersecurechat.app.data.SscHttpClient
import com.supersecurechat.app.data.SignalMessaging
import com.supersecurechat.app.data.StoriesRepository
import com.supersecurechat.app.data.UserRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ConversationListScreen(
    conversations: ConversationRepository,
    users: UserRepository,
    groups: GroupsRepository,
    auth: AuthRepository,
    search: LocalSearch? = null,
    social: SocialRepository? = null,
    stories: StoriesRepository? = null,
    signal: SignalMessaging? = null,
    connectionState: String = "offline",
    refreshToken: Int = 0,
    onOpenChat: (ConversationRepository.Conversation) -> Unit,
    onSettings: () -> Unit,
    onLoggedOut: () -> Unit,
    onReconnect: () -> Unit = {},
) {
    var items by remember { mutableStateOf<List<ConversationRepository.Conversation>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showNew by remember { mutableStateOf(false) }
    var showGroup by remember { mutableStateOf(false) }
    var peerQuery by remember { mutableStateOf("") }
    var groupName by remember { mutableStateOf("") }
    var groupMembers by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }
    var searchHits by remember { mutableStateOf<List<LocalSearch.Hit>>(emptyList()) }
    var storyFeed by remember { mutableStateOf<List<StoriesRepository.Story>>(emptyList()) }
    var showStory by remember { mutableStateOf(false) }
    var storyText by remember { mutableStateOf("") }
    var statusToast by remember { mutableStateOf<String?>(null) }
    var metaConv by remember { mutableStateOf<ConversationRepository.Conversation?>(null) }
    val scope = rememberCoroutineScope()

    fun refresh() {
        loading = true
        error = null
        scope.launch {
            try {
                items = withContext(Dispatchers.IO) { conversations.listConversations() }
                storyFeed = withContext(Dispatchers.IO) {
                    stories?.feed() ?: emptyList()
                }
            } catch (e: SscHttpClient.ApiException) {
                error = e.detail
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(refreshToken) { refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chats", fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
                actions = {
                    IconButton(onClick = { showGroup = true }) {
                        Icon(Icons.Default.GroupAdd, contentDescription = "New group")
                    }
                    IconButton(onClick = { refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                    IconButton(onClick = {
                        scope.launch {
                            withContext(Dispatchers.IO) { auth.logout() }
                            onLoggedOut()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Log out")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showNew = true }) {
                Icon(Icons.Default.Add, contentDescription = "New chat")
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { q ->
                    searchQuery = q
                    searchHits = if (q.length >= 2 && search != null) search.search(q) else emptyList()
                },
                label = { Text("Search messages") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (storyFeed.isEmpty()) "Stories" else "Stories: ${storyFeed.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                TextButton(onClick = { showStory = true }) { Text("Add story") }
            }
            if (connectionState != "online") {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(
                            if (connectionState == "connecting") MaterialTheme.colorScheme.tertiaryContainer
                            else MaterialTheme.colorScheme.errorContainer,
                        )
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        when (connectionState) {
                            "connecting" -> "Connecting…"
                            else -> "Offline — messages will sync when back online"
                        },
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (connectionState == "offline") {
                        TextButton(onClick = onReconnect) { Text("Retry") }
                    }
                }
            }
            statusToast?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
            PullToRefreshBox(
                isRefreshing = loading,
                onRefresh = { refresh() },
                modifier = Modifier.weight(1f).fillMaxSize(),
            ) {
                Box(Modifier.fillMaxSize()) {
                    when {
                        searchHits.isNotEmpty() -> {
                            LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                                items(searchHits, key = { it.messageId }) { hit ->
                                    Column(
                                        Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                items.find { it.id == hit.conversationId }?.let(onOpenChat)
                                            }
                                            .padding(horizontal = 16.dp, vertical = 10.dp),
                                    ) {
                                        Text(hit.snippet, style = MaterialTheme.typography.bodyMedium)
                                        Text(hit.conversationId, style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                        loading && items.isEmpty() -> {
                            CircularProgressIndicator(Modifier.align(Alignment.Center))
                        }
                        error != null && items.isEmpty() -> {
                            Column(
                                Modifier.align(Alignment.Center).padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(error ?: "Error", color = MaterialTheme.colorScheme.error)
                                TextButton(onClick = { refresh() }) { Text("Retry") }
                            }
                        }
                        items.isEmpty() -> {
                            Text(
                                "No conversations yet.\nTap + and enter a username or user id.\nPull down to refresh.",
                                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        else -> {
                            LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                                items(items, key = { it.id }) { conv ->
                                    ConversationRow(
                                        conv = conv,
                                        onClick = { onOpenChat(conv) },
                                        onLongClick = { metaConv = conv },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    metaConv?.let { conv ->
        AlertDialog(
            onDismissRequest = { metaConv = null },
            title = { Text(conv.title) },
            text = {
                Column {
                    Text("Chat options")
                    Text(
                        "Privacy: receipts/typing can be toggled per chat.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                conversations.setPinned(conv.id, !conv.pinned)
                            }
                            metaConv = null
                            refresh()
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) { Text(if (conv.pinned) "Unpin" else "Pin") }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    conversations.setMuted(conv.id, !conv.muted)
                                }
                                metaConv = null
                                refresh()
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) { Text(if (conv.muted) "Unmute" else "Mute") }
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    conversations.setChatPrivacy(
                                        conv.id,
                                        readReceipts = false,
                                        typingVisible = false,
                                    )
                                }
                                statusToast = "Chat privacy tightened"
                                metaConv = null
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) { Text("Hide receipts") }
                    TextButton(onClick = { metaConv = null }) { Text("Close") }
                }
            },
        )
    }

    if (showNew) {
        AlertDialog(
            onDismissRequest = { showNew = false },
            title = { Text("New chat") },
            text = {
                Column {
                    Text(
                        "Username (@name) or user id",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    OutlinedTextField(
                        value = peerQuery,
                        onValueChange = { peerQuery = it },
                        label = { Text("User") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                    }
                }
            },
            confirmButton = {
                Row {
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    val q = peerQuery.trim().removePrefix("@")
                                    val peer = users.lookup(q)
                                    social?.sendRequest(peer.id, note = "Hi from SSC")
                                }
                                error = null
                                showNew = false
                                peerQuery = ""
                                statusToast = "Friend request sent"
                            } catch (e: SscHttpClient.ApiException) {
                                error = e.detail
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) { Text("Add friend") }
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                val conv = withContext(Dispatchers.IO) {
                                    val q = peerQuery.trim().removePrefix("@")
                                    val peerId = try {
                                        users.lookup(q).id
                                    } catch (_: Exception) {
                                        q
                                    }
                                    conversations.createDirect(peerId)
                                }
                                showNew = false
                                peerQuery = ""
                                refresh()
                                onOpenChat(conv)
                            } catch (e: SscHttpClient.ApiException) {
                                error = e.detail
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) { Text("Chat") }
                }
            },
            dismissButton = {
                TextButton(onClick = { showNew = false }) { Text("Cancel") }
            },
        )
    }

    if (showStory) {
        AlertDialog(
            onDismissRequest = { showStory = false },
            title = { Text("New story") },
            text = {
                OutlinedTextField(
                    value = storyText,
                    onValueChange = { storyText = it },
                    label = { Text("Story text") },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val plain = JSONObject().put("text", storyText).toString()
                                val plainB64 = android.util.Base64.encodeToString(
                                    plain.toByteArray(Charsets.UTF_8),
                                    android.util.Base64.NO_WRAP,
                                )
                                val ct = signal?.encryptFileBytes(plainB64)
                                    ?: throw IllegalStateException("crypto_unavailable")
                                stories?.create(ct, "signal_v1_story")
                            }
                            showStory = false
                            storyText = ""
                            refresh()
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) { Text("Post") }
            },
            dismissButton = {
                TextButton(onClick = { showStory = false }) { Text("Cancel") }
            },
        )
    }

    if (showGroup) {
        AlertDialog(
            onDismissRequest = { showGroup = false },
            title = { Text("New group") },
            text = {
                Column {
                    OutlinedTextField(
                        value = groupName,
                        onValueChange = { groupName = it },
                        label = { Text("Group name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = groupMembers,
                        onValueChange = { groupMembers = it },
                        label = { Text("Member usernames/ids (comma-separated)") },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val ids = groupMembers.split(",")
                                    .map { it.trim().removePrefix("@") }
                                    .filter { it.isNotBlank() }
                                    .map { token ->
                                        try {
                                            users.lookup(token).id
                                        } catch (_: Exception) {
                                            token
                                        }
                                    }
                                groups.createGroup(groupName, ids)
                            }
                            showGroup = false
                            groupName = ""
                            groupMembers = ""
                            refresh()
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) { Text("Create") }
            },
            dismissButton = {
                TextButton(onClick = { showGroup = false }) { Text("Cancel") }
            },
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ConversationRow(
    conv: ConversationRepository.Conversation,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
) {
    Row(
        Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                buildString {
                    if (conv.pinned) append("📌 ")
                    if (conv.muted) append("🔇 ")
                    append(conv.title)
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )
            Text(
                conv.type,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (conv.unread > 0 && !conv.muted) {
            Text(
                "${conv.unread}",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
        } else if (conv.unread > 0) {
            Text(
                "${conv.unread}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}
