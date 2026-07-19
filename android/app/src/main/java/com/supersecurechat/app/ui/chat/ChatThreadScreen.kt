package com.supersecurechat.app.ui.chat

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import com.supersecurechat.app.data.CallCoordinator
import com.supersecurechat.app.data.CallsRepository
import com.supersecurechat.app.data.ChatEventBus
import com.supersecurechat.app.data.ConversationRepository
import com.supersecurechat.app.data.FilesRepository
import com.supersecurechat.app.data.GroupsRepository
import com.supersecurechat.app.data.PollsRepository
import com.supersecurechat.app.data.PresenceRepository
import com.supersecurechat.app.data.ReactionsRepository
import com.supersecurechat.app.data.SessionStore
import com.supersecurechat.app.data.SfuRepository
import com.supersecurechat.app.data.SignalMessaging
import com.supersecurechat.app.data.SocialRepository
import com.supersecurechat.app.data.SscHttpClient
import com.supersecurechat.app.data.VoiceNoteRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatThreadScreen(
    conversation: ConversationRepository.Conversation,
    conversations: ConversationRepository,
    signal: SignalMessaging,
    session: SessionStore,
    reactions: ReactionsRepository,
    files: FilesRepository,
    social: SocialRepository,
    calls: CallsRepository,
    presence: PresenceRepository,
    callCoord: CallCoordinator,
    polls: PollsRepository,
    sfu: SfuRepository? = null,
    groups: GroupsRepository? = null,
    chatEvents: ChatEventBus? = null,
    refreshToken: Int = 0,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var messages by remember { mutableStateOf<List<ConversationRepository.Message>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var safetyText by remember { mutableStateOf<String?>(null) }
    var menuMessage by remember { mutableStateOf<ConversationRepository.Message?>(null) }
    var replyTo by remember { mutableStateOf<ConversationRepository.Message?>(null) }
    var editMessage by remember { mutableStateOf<ConversationRepository.Message?>(null) }
    var editDraft by remember { mutableStateOf("") }
    var recording by remember { mutableStateOf(false) }
    var presenceLabel by remember { mutableStateOf<String?>(null) }
    var showPoll by remember { mutableStateOf(false) }
    var pollQuestion by remember { mutableStateOf("") }
    var peerTyping by remember { mutableStateOf(false) }
    var readIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var threadFilter by remember { mutableStateOf("") }
    var showMembers by remember { mutableStateOf(false) }
    var members by remember { mutableStateOf<List<GroupsRepository.Member>>(emptyList()) }
    var reactionLabels by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val myId = session.userId
    var typingJob by remember { mutableStateOf<Job?>(null) }
    val voiceRecorder = remember { VoiceNoteRecorder(context) }
    val typingEvent by (chatEvents?.typing?.collectAsState()
        ?: remember { mutableStateOf(null) })

    fun openAttachment(fileId: String) {
        scope.launch {
            try {
                val (remote, bytes) = withContext(Dispatchers.IO) {
                    files.download(fileId)
                }
                if (bytes == null) {
                    error = "decrypt_failed"
                    return@launch
                }
                val ext = when {
                    remote.mimeHint?.contains("audio") == true -> ".m4a"
                    remote.mimeHint?.contains("png") == true -> ".png"
                    remote.mimeHint?.contains("jpeg") == true || remote.mimeHint?.contains("jpg") == true -> ".jpg"
                    remote.mimeHint?.contains("pdf") == true -> ".pdf"
                    else -> ".bin"
                }
                val out = File(context.cacheDir, "ssc-file-$fileId$ext")
                withContext(Dispatchers.IO) {
                    FileOutputStream(out).use { it.write(bytes) }
                }
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    out,
                )
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, remote.mimeHint ?: "*/*")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Open attachment"))
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    fun encryptAndSend(text: String, replyId: String? = null) {
        val peerId = conversation.peerId
        val sealed = session.sealedSenderEnabled
        val disappear = session.disappearingSecondsDefault.takeIf { it > 0 }
        if (conversation.type == "direct") {
            require(!peerId.isNullOrBlank())
            val multi = signal.encryptForAllDevices(text, peerId!!)
            conversations.sendCiphertextWithMeta(
                conversationId = conversation.id,
                ciphertext = multi.legacyCiphertext,
                protocol = multi.protocol,
                plaintext = text,
                replyTo = replyId,
                disappearingSeconds = disappear,
                deviceCiphertexts = multi.deviceCiphertexts,
                sealed = sealed,
            )
        } else {
            val groupId = conversation.groupId ?: throw IllegalStateException("group_id_missing")
            val (ct, protocol) = signal.encryptGroup(conversation.id, groupId, text)
            conversations.sendCiphertextWithMeta(
                conversation.id,
                ct,
                protocol,
                plaintext = text,
                replyTo = replyId,
                disappearingSeconds = disappear,
                sealed = sealed,
            )
        }
    }

    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            sending = true
            try {
                withContext(Dispatchers.IO) {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: throw IllegalStateException("cannot_read_file")
                    val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
                    val remote = files.uploadEncryptedBytes(conversation.id, bytes, mime)
                    encryptAndSend("[file:${remote.id}] $mime (${remote.sizeBytes}b)")
                }
                messages = withContext(Dispatchers.IO) {
                    conversations.listMessages(conversation.id, signal)
                }
            } catch (e: Exception) {
                error = e.message
            } finally {
                sending = false
            }
        }
    }

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) error = "microphone_permission_denied"
    }

    fun refreshReactions() {
        scope.launch {
            try {
                reactionLabels = withContext(Dispatchers.IO) {
                    reactions.aggregateByTarget(
                        conversation.id,
                        signal,
                        conversation.peerId,
                        myId,
                    )
                }
            } catch (_: Exception) {
            }
        }
    }

    fun refreshMessages() {
        scope.launch {
            try {
                messages = withContext(Dispatchers.IO) {
                    conversations.listMessages(conversation.id, signal)
                }
                refreshReactions()
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    fun startOutgoingCall(video: Boolean = false) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            micPermission.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        if (video &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            // Fall back to audio-only if camera not granted
            error = "camera_permission_needed — starting audio"
        }
        val isGroup = conversation.type == "group"
        if (!isGroup && conversation.peerId.isNullOrBlank()) {
            error = "call_requires_peer"
            return
        }
        val hasCam = video &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        callCoord.startOutgoing(
            conversationId = conversation.id,
            peerId = conversation.peerId,
            video = hasCam,
            groupCall = isGroup,
            sfu = sfu,
            localUserId = myId,
        )
    }

    DisposableEffect(Unit) {
        onDispose {
            if (recording) voiceRecorder.stop()
        }
    }

    LaunchedEffect(conversation.id, refreshToken) {
        loading = messages.isEmpty()
        try {
            messages = withContext(Dispatchers.IO) {
                conversations.listMessages(conversation.id, signal)
            }
            val last = messages.lastOrNull()?.id
            withContext(Dispatchers.IO) {
                conversations.markRead(conversation.id, last)
                readIds = conversations.fetchReadMessageIds(conversation.id)
                if (conversation.peerId != null) {
                    presenceLabel = presence.lastSeen(conversation.peerId!!, conversation.id)
                }
                reactionLabels = reactions.aggregateByTarget(
                    conversation.id,
                    signal,
                    conversation.peerId,
                    myId,
                )
            }
        } catch (e: Exception) {
            error = e.message
        } finally {
            loading = false
        }
    }

    // Presence refresh while thread open
    LaunchedEffect(conversation.id, conversation.peerId) {
        val peer = conversation.peerId ?: return@LaunchedEffect
        while (true) {
            presenceLabel = withContext(Dispatchers.IO) {
                presence.lastSeen(peer, conversation.id)
            }
            delay(45_000)
        }
    }

    // Peer typing from WebSocket
    LaunchedEffect(typingEvent, conversation.id) {
        val ev = typingEvent ?: return@LaunchedEffect
        val forThis = ev.conversationId == null ||
            ev.conversationId == conversation.id
        if (!forThis) return@LaunchedEffect
        if (ev.userId != null && ev.userId == myId) return@LaunchedEffect
        peerTyping = ev.active
        if (ev.active) {
            delay(3_500)
            peerTyping = false
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(conversation.title)
                        val flags = buildList {
                            if (session.sealedSenderEnabled) add("sealed")
                            if (session.disappearingSecondsDefault > 0) {
                                add("⏱${session.disappearingSecondsDefault}s")
                            }
                            if (peerTyping) add("typing…")
                            else presenceLabel?.let { add(it) }
                        }
                        if (flags.isNotEmpty()) {
                            Text(
                                flags.joinToString(" · "),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (peerTyping) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (conversation.type == "group" && conversation.groupId != null && groups != null) {
                        TextButton(onClick = {
                            scope.launch {
                                members = withContext(Dispatchers.IO) {
                                    groups.listMembers(conversation.groupId!!)
                                }
                                showMembers = true
                            }
                        }) { Text("Members") }
                    }
                    TextButton(onClick = { showPoll = true }) { Text("Poll") }
                    IconButton(onClick = { startOutgoingCall(video = false) }) {
                        Icon(Icons.Default.Call, contentDescription = "Audio call")
                    }
                    IconButton(onClick = { startOutgoingCall(video = true) }) {
                        Icon(Icons.Default.Videocam, contentDescription = "Video call")
                    }
                    if (conversation.peerId != null) {
                        IconButton(onClick = {
                            scope.launch {
                                try {
                                    val text = withContext(Dispatchers.IO) {
                                        val key = conversations.fetchPeerIdentityKey(conversation.peerId!!)
                                            ?: return@withContext "unavailable"
                                        signal.safetyNumber(conversation.peerId!!, key)
                                    }
                                    safetyText = text
                                } catch (e: Exception) {
                                    error = e.message
                                }
                            }
                        }) {
                            Icon(Icons.Default.VerifiedUser, contentDescription = "Safety number")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = threadFilter,
                onValueChange = { threadFilter = it },
                label = { Text("Filter in thread") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            )
            val visibleMessages = if (threadFilter.isBlank()) {
                messages
            } else {
                messages.filter {
                    it.plaintext?.contains(threadFilter, ignoreCase = true) == true
                }
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when {
                    loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                    error != null && messages.isEmpty() -> Text(
                        error ?: "Error",
                        Modifier.align(Alignment.Center).padding(16.dp),
                        color = MaterialTheme.colorScheme.error,
                    )
                    visibleMessages.isEmpty() && threadFilter.isNotBlank() -> Text(
                        "No matches for \"$threadFilter\"",
                        Modifier.align(Alignment.Center).padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    else -> LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(visibleMessages, key = { it.id }) { msg ->
                            val mine = msg.senderId == myId
                            val plain = msg.plaintext ?: "[…]"
                            val fileMatch = Regex("\\[file:([^\\]]+)\\]").find(plain)
                            val voiceMatch = Regex("\\[voice:([^\\]]+)\\]").find(plain)
                            val fileId = fileMatch?.groupValues?.get(1) ?: voiceMatch?.groupValues?.get(1)
                            val pollContent = polls.parsePollText(plain)
                            val read = mine && readIds.contains(msg.id)
                            val display = buildString {
                                when {
                                    pollContent != null -> {
                                        append("📊 ${pollContent.question}\n")
                                        pollContent.options.forEachIndexed { i, o ->
                                            append("  ${i + 1}. $o\n")
                                        }
                                        if (msg.pollId != null) append("Long-press to vote")
                                    }
                                    else -> append(plain)
                                }
                                if (mine && !msg.id.startsWith("local-")) {
                                    append(if (read) "  ✓✓" else "  ✓")
                                }
                            }
                            val reactionLabel = reactionLabels[msg.id]
                            Column(
                                Modifier.fillMaxWidth(),
                                horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
                            ) {
                                Text(
                                    text = display.trimEnd(),
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(
                                            if (mine) MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
                                            else MaterialTheme.colorScheme.surfaceVariant,
                                        )
                                        .combinedClickable(
                                            onClick = {
                                                if (fileId != null) openAttachment(fileId)
                                            },
                                            onLongClick = { menuMessage = msg },
                                        )
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    color = if (fileId != null) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onSurface,
                                )
                                if (!reactionLabel.isNullOrBlank()) {
                                    Text(
                                        reactionLabel,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }

            replyTo?.let { r ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Reply: ${(r.plaintext ?: "").take(40)}",
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    TextButton(onClick = { replyTo = null }) { Text("Cancel") }
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { pickFile.launch("*/*") }) {
                    Icon(Icons.Default.AttachFile, contentDescription = "Attach")
                }
                IconButton(onClick = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                        return@IconButton
                    }
                    if (recording) {
                        val file = voiceRecorder.stop()
                        recording = false
                        if (file != null && file.exists()) {
                            scope.launch {
                                sending = true
                                try {
                                    withContext(Dispatchers.IO) {
                                        val bytes = file.readBytes()
                                        val remote = files.uploadEncryptedBytes(
                                            conversation.id,
                                            bytes,
                                            "audio/mp4",
                                        )
                                        encryptAndSend("[voice:${remote.id}]")
                                    }
                                    refreshMessages()
                                } catch (e: Exception) {
                                    error = e.message
                                } finally {
                                    sending = false
                                    file.delete()
                                }
                            }
                        }
                    } else {
                        try {
                            voiceRecorder.start()
                            recording = true
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) {
                    Icon(
                        if (recording) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = if (recording) "Stop" else "Voice",
                        tint = if (recording) MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.onSurface,
                    )
                }
                OutlinedTextField(
                    value = draft,
                    onValueChange = { v ->
                        draft = v
                        typingJob?.cancel()
                        typingJob = scope.launch {
                            withContext(Dispatchers.IO) {
                                conversations.sendTyping(conversation.id, true)
                            }
                            delay(2500)
                            withContext(Dispatchers.IO) {
                                conversations.sendTyping(conversation.id, false)
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(if (recording) "Recording…" else "Message") },
                    maxLines = 4,
                    enabled = !recording,
                )
                IconButton(
                    enabled = draft.isNotBlank() && !sending &&
                        (conversation.type != "direct" || !conversation.peerId.isNullOrBlank()),
                    onClick = {
                        val text = draft.trim()
                        sending = true
                        error = null
                        // Optimistic bubble while encrypt/upload runs
                        val optimisticId = "local-${UUID.randomUUID()}"
                        messages = messages + ConversationRepository.Message(
                            id = optimisticId,
                            conversationId = conversation.id,
                            senderId = myId,
                            ciphertext = null,
                            protocol = null,
                            createdAt = null,
                            plaintext = "$text  …",
                        )
                        draft = ""
                        val replyId = replyTo?.id
                        replyTo = null
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    encryptAndSend(text, replyId)
                                    conversations.sendTyping(conversation.id, false)
                                }
                                refreshMessages()
                            } catch (e: SscHttpClient.ApiException) {
                                error = e.detail
                                messages = messages.filter { it.id != optimisticId }
                            } catch (e: Exception) {
                                error = e.message
                                messages = messages.filter { it.id != optimisticId }
                            } finally {
                                sending = false
                            }
                        }
                    },
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }
            error?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }
    }

    menuMessage?.let { msg ->
        val pollContent = polls.parsePollText(msg.plaintext)
        val pollIdForVote = msg.pollId
        AlertDialog(
            onDismissRequest = { menuMessage = null },
            title = { Text("Message") },
            text = {
                Column {
                    Text(
                        when {
                            pollContent != null -> "📊 ${pollContent.question}"
                            else -> (msg.plaintext ?: msg.id).take(200)
                        },
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("React", style = MaterialTheme.typography.labelMedium)
                    Row {
                        listOf("👍", "❤️", "😂", "😮", "😢", "🙏").forEach { emoji ->
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) {
                                            val peerId = conversation.peerId
                                            if (peerId != null) {
                                                val payload = JSONObject()
                                                    .put("emoji", emoji)
                                                    .put("target", msg.id)
                                                    .toString()
                                                try {
                                                    signal.establishWithPeer(peerId)
                                                } catch (_: Exception) {
                                                }
                                                val (ct, _) = signal.encrypt(payload, peerId)
                                                reactions.addReaction(conversation.id, msg.id, ct)
                                            } else if (conversation.groupId != null) {
                                                val payload = JSONObject()
                                                    .put("emoji", emoji)
                                                    .put("target", msg.id)
                                                    .toString()
                                                val (ct, _) = signal.encryptGroup(
                                                    conversation.id,
                                                    conversation.groupId!!,
                                                    payload,
                                                )
                                                reactions.addReaction(
                                                    conversation.id,
                                                    msg.id,
                                                    ct,
                                                    protocol = "signal_v1_reaction",
                                                )
                                            }
                                        }
                                    } catch (e: Exception) {
                                        error = e.message
                                    }
                                    menuMessage = null
                                    refreshReactions()
                                }
                            }) { Text(emoji) }
                        }
                    }
                    if (pollContent != null && !pollIdForVote.isNullOrBlank()) {
                        Text("Vote", style = MaterialTheme.typography.labelMedium)
                        pollContent.options.forEachIndexed { index, label ->
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) {
                                            val votePlain = polls.buildVotePlaintext(index)
                                            val peerId = conversation.peerId
                                            val ct = if (conversation.type == "direct" && peerId != null) {
                                                try {
                                                    signal.establishWithPeer(peerId)
                                                } catch (_: Exception) {
                                                }
                                                signal.encrypt(votePlain, peerId).first
                                            } else {
                                                val groupId = conversation.groupId
                                                    ?: throw IllegalStateException("group_id_missing")
                                                signal.encryptGroup(
                                                    conversation.id,
                                                    groupId,
                                                    votePlain,
                                                ).first
                                            }
                                            polls.vote(conversation.id, pollIdForVote, ct)
                                        }
                                        menuMessage = null
                                        error = "Voted: $label"
                                    } catch (e: Exception) {
                                        error = e.message
                                    }
                                }
                            }) { Text(label) }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    replyTo = msg
                    menuMessage = null
                }) { Text("Reply") }
            },
            dismissButton = {
                Row {
                    if (msg.senderId == myId) {
                        TextButton(onClick = {
                            editMessage = msg
                            editDraft = msg.plaintext ?: ""
                            menuMessage = null
                        }) { Text("Edit") }
                        TextButton(onClick = {
                            scope.launch {
                                try {
                                    withContext(Dispatchers.IO) {
                                        conversations.deleteMessage(msg.id, "everyone")
                                    }
                                    refreshMessages()
                                } catch (e: Exception) {
                                    error = e.message
                                }
                                menuMessage = null
                            }
                        }) { Text("Delete") }
                    } else {
                        TextButton(onClick = {
                            scope.launch {
                                try {
                                    withContext(Dispatchers.IO) {
                                        conversations.deleteMessage(msg.id, "me")
                                    }
                                    messages = messages.filter { it.id != msg.id }
                                } catch (e: Exception) {
                                    error = e.message
                                }
                                menuMessage = null
                            }
                        }) { Text("Hide") }
                        if (conversation.peerId != null) {
                            TextButton(onClick = {
                                scope.launch {
                                    withContext(Dispatchers.IO) {
                                        social.block(conversation.peerId!!)
                                    }
                                    menuMessage = null
                                    onBack()
                                }
                            }) { Text("Block") }
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) {
                                            social.report(
                                                conversation.peerId!!,
                                                reason = "user_report",
                                                conversationId = conversation.id,
                                                alsoBlock = false,
                                            )
                                        }
                                        error = "Report sent"
                                    } catch (e: Exception) {
                                        error = e.message
                                    }
                                    menuMessage = null
                                }
                            }) { Text("Report") }
                        }
                    }
                }
            },
        )
    }

    editMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { editMessage = null },
            title = { Text("Edit message") },
            text = {
                OutlinedTextField(
                    value = editDraft,
                    onValueChange = { editDraft = it },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val peerId = conversation.peerId
                                if (conversation.type == "direct" && peerId != null) {
                                    val multi = signal.encryptForAllDevices(editDraft, peerId)
                                    conversations.editMessage(
                                        msg.id,
                                        multi.legacyCiphertext,
                                        multi.protocol,
                                        multi.deviceCiphertexts,
                                    )
                                } else {
                                    val groupId = conversation.groupId
                                        ?: throw IllegalStateException("group_id_missing")
                                    val (ct, protocol) = signal.encryptGroup(
                                        conversation.id, groupId, editDraft,
                                    )
                                    conversations.editMessage(msg.id, ct, protocol)
                                }
                            }
                            editMessage = null
                            refreshMessages()
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { editMessage = null }) { Text("Cancel") }
            },
        )
    }

    safetyText?.let { sn ->
        AlertDialog(
            onDismissRequest = { safetyText = null },
            title = { Text("Safety number") },
            text = { Text(sn.ifBlank { "Could not compute safety number" }) },
            confirmButton = {
                TextButton(onClick = { safetyText = null }) { Text("OK") }
            },
        )
    }

    if (showMembers) {
        AlertDialog(
            onDismissRequest = { showMembers = false },
            title = { Text("Members (${members.size})") },
            text = {
                Column {
                    if (members.isEmpty()) {
                        Text("No members loaded")
                    } else {
                        members.forEach { m ->
                            Text(
                                m.displayName ?: m.username?.let { "@$it" } ?: m.id,
                                modifier = Modifier.padding(vertical = 4.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showMembers = false }) { Text("OK") }
            },
            dismissButton = {
                if (conversation.groupId != null && groups != null) {
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    groups.leaveGroup(conversation.groupId!!)
                                }
                                showMembers = false
                                onBack()
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) { Text("Leave group") }
                }
            },
        )
    }

    if (showPoll) {
        AlertDialog(
            onDismissRequest = { showPoll = false },
            title = { Text("New poll") },
            text = {
                OutlinedTextField(
                    value = pollQuestion,
                    onValueChange = { pollQuestion = it },
                    label = { Text("Question (Yes/No options)") },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (pollQuestion.isBlank()) return@TextButton
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val options = listOf("Yes", "No")
                                val payload = polls.buildCreatePlaintext(pollQuestion, options)
                                val peerId = conversation.peerId
                                val ciphertext = if (conversation.type == "direct" && peerId != null) {
                                    signal.encryptForAllDevices(payload, peerId).legacyCiphertext
                                } else {
                                    val groupId = conversation.groupId
                                        ?: throw IllegalStateException("group_id_missing")
                                    signal.encryptGroup(conversation.id, groupId, payload).first
                                }
                                polls.createPoll(
                                    conversation.id,
                                    ciphertext,
                                    optionCount = options.size,
                                    protocol = PollsRepository.PROTOCOL,
                                )
                            }
                            showPoll = false
                            pollQuestion = ""
                            refreshMessages()
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }) { Text("Create") }
            },
            dismissButton = {
                TextButton(onClick = { showPoll = false }) { Text("Cancel") }
            },
        )
    }
}

