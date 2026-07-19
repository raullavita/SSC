package com.supersecurechat.app.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.supersecurechat.app.BuildConfig
import com.supersecurechat.app.data.AuthRepository
import com.supersecurechat.app.data.BackupRepository
import com.supersecurechat.app.data.BroadcastRepository
import com.supersecurechat.app.data.DevicesRepository
import com.supersecurechat.app.data.LocalMessageDb
import com.supersecurechat.app.data.PrivacyRepository
import com.supersecurechat.app.data.SessionStore
import com.supersecurechat.app.data.SignalMessaging
import com.supersecurechat.app.data.SocialRepository
import com.supersecurechat.app.data.SscHttpClient
import com.supersecurechat.app.data.UserRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    session: SessionStore,
    auth: AuthRepository,
    users: UserRepository,
    devices: DevicesRepository,
    social: SocialRepository,
    signal: SignalMessaging,
    db: LocalMessageDb,
    backup: BackupRepository,
    broadcast: BroadcastRepository? = null,
    privacyRepo: PrivacyRepository? = null,
    onBack: () -> Unit,
    onPanicDone: () -> Unit,
) {
    var usernameDraft by remember { mutableStateOf(session.username ?: "") }
    var recoveryPass by remember { mutableStateOf("") }
    var backupPass by remember { mutableStateOf("") }
    var linkDeep by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var deviceList by remember { mutableStateOf<List<DevicesRepository.Device>>(emptyList()) }
    var incoming by remember { mutableStateOf<List<SocialRepository.FriendRequest>>(emptyList()) }
    var showPanic by remember { mutableStateOf(false) }
    var sealedSender by remember { mutableStateOf(session.sealedSenderEnabled) }
    var disappearSec by remember { mutableStateOf(session.disappearingSecondsDefault) }
    var broadcastLists by remember { mutableStateOf<List<BroadcastRepository.BroadcastList>>(emptyList()) }
    var broadcastMsg by remember { mutableStateOf("") }
    var selectedBroadcast by remember { mutableStateOf<BroadcastRepository.BroadcastList?>(null) }
    var privacy by remember { mutableStateOf(PrivacyRepository.Settings()) }
    var prekeyInfo by remember { mutableStateOf("Prekeys: …") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val importBackup = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        if (uri == null || backupPass.length < 8) {
            error = "Pick a .sscbackup file and set passphrase first"
            return@rememberLauncherForActivityResult
        }
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val tmp = File(context.cacheDir, "import-backup.sscbackup")
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(tmp).use { output -> input.copyTo(output) }
                    } ?: throw IllegalStateException("cannot_read_backup")
                    backup.importEncrypted(tmp, backupPass)
                    tmp.delete()
                }
                status = "Backup imported into local cache"
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    fun refresh() {
        scope.launch {
            try {
                deviceList = withContext(Dispatchers.IO) {
                    try {
                        devices.registerThisDevice()
                    } catch (_: Exception) {
                    }
                    devices.list()
                }
                incoming = withContext(Dispatchers.IO) {
                    try {
                        social.incomingRequests()
                    } catch (_: Exception) {
                        emptyList()
                    }
                }
                broadcastLists = withContext(Dispatchers.IO) {
                    broadcast?.list() ?: emptyList()
                }
                privacy = withContext(Dispatchers.IO) {
                    privacyRepo?.get() ?: PrivacyRepository.Settings()
                }
                prekeyInfo = withContext(Dispatchers.IO) {
                    try {
                        signal.prekeyStatusSummary()
                    } catch (_: Exception) {
                        "Prekeys: unavailable"
                    }
                }
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text("Account", style = MaterialTheme.typography.titleMedium)
            Text("User id: ${session.userId ?: "—"}")
            Text("Display name: ${session.displayName ?: "—"}")
            Text("Device id: ${session.deviceId}", style = MaterialTheme.typography.bodySmall)
            if (!session.username.isNullOrBlank()) {
                val invite = "https://www.supersecurechat.com/add/${session.username}"
                Text("Invite: $invite", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                Row(Modifier.padding(top = 4.dp)) {
                    Button(onClick = {
                        try {
                            val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
                                as android.content.ClipboardManager
                            cm.setPrimaryClip(
                                android.content.ClipData.newPlainText("SSC invite", invite),
                            )
                            status = "Invite link copied"
                        } catch (_: Exception) {
                            status = invite
                        }
                    }) { Text("Copy invite") }
                    OutlinedButton(onClick = {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, "Chat with me on SSC: $invite")
                        }
                        context.startActivity(Intent.createChooser(intent, "Share invite"))
                    }, modifier = Modifier.padding(start = 8.dp)) { Text("Share") }
                }
            }

            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = usernameDraft,
                onValueChange = { usernameDraft = it },
                label = { Text("Username") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                enabled = session.username.isNullOrBlank(),
            )
            if (session.username.isNullOrBlank()) {
                Button(
                    onClick = {
                        scope.launch {
                            error = null
                            try {
                                val u = withContext(Dispatchers.IO) { users.setUsername(usernameDraft) }
                                session.username = u.username
                                status = "Username @${u.username}"
                            } catch (e: SscHttpClient.ApiException) {
                                error = e.detail
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    },
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text("Save username") }
            }

            Spacer(Modifier.height(20.dp))
            Text("Privacy", style = MaterialTheme.typography.titleMedium)
            Text(prekeyInfo, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = {
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            signal.ensurePrekeysUploaded()
                        }
                        prekeyInfo = withContext(Dispatchers.IO) { signal.prekeyStatusSummary() }
                        status = "Prekeys refreshed"
                    } catch (e: Exception) {
                        error = e.message
                    }
                }
            }) { Text("Refresh encryption keys") }
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Sealed sender")
                    Text(
                        "Hide your sender id from recipients when possible",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = sealedSender,
                    onCheckedChange = {
                        sealedSender = it
                        session.sealedSenderEnabled = it
                        status = if (it) "Sealed sender on" else "Sealed sender off"
                    },
                )
            }
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Show last seen", Modifier.weight(1f))
                Switch(
                    checked = privacy.lastSeenVisible,
                    onCheckedChange = { on ->
                        scope.launch {
                            try {
                                privacy = withContext(Dispatchers.IO) {
                                    privacyRepo?.patch(lastSeenVisible = on) ?: privacy.copy(lastSeenVisible = on)
                                }
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    },
                )
            }
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Read receipts (global)", Modifier.weight(1f))
                Switch(
                    checked = privacy.readReceipts,
                    onCheckedChange = { on ->
                        scope.launch {
                            try {
                                privacy = withContext(Dispatchers.IO) {
                                    privacyRepo?.patch(readReceipts = on) ?: privacy.copy(readReceipts = on)
                                }
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    },
                )
            }
            Text(
                "Disappearing messages default: ${if (disappearSec == 0) "off" else "${disappearSec}s"}",
                style = MaterialTheme.typography.bodyMedium,
            )
            Row(Modifier.padding(top = 4.dp)) {
                listOf(0, 60, 3600, 86400).forEach { sec ->
                    TextButton(onClick = {
                        disappearSec = sec
                        session.disappearingSecondsDefault = sec
                        status = "Disappearing default set"
                    }) {
                        Text(
                            when (sec) {
                                0 -> "Off"
                                60 -> "1m"
                                3600 -> "1h"
                                else -> "1d"
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text("Recovery passphrase", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = recoveryPass,
                onValueChange = { recoveryPass = it },
                label = { Text("New recovery passphrase") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { auth.setupRecovery(recoveryPass) }
                            status = "Recovery passphrase saved"
                            recoveryPass = ""
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                },
                enabled = recoveryPass.length >= 12,
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Save recovery") }

            Spacer(Modifier.height(20.dp))
            Text("Link another device", style = MaterialTheme.typography.titleMedium)
            Button(
                onClick = {
                    scope.launch {
                        try {
                            val link = withContext(Dispatchers.IO) {
                                devices.createLinkToken("Secondary device")
                            }
                            linkDeep = link.deepLink
                            status = "Link token ready (expires ${link.expiresInSeconds}s)"
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                },
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Create link token") }
            linkDeep?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
            }

            Spacer(Modifier.height(20.dp))
            Text("Local backup", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = backupPass,
                onValueChange = { backupPass = it },
                label = { Text("Backup passphrase") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(Modifier.padding(top = 8.dp)) {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val file = withContext(Dispatchers.IO) {
                                    backup.exportEncrypted(backupPass)
                                }
                                // Share via system sheet (free — no cloud required)
                                try {
                                    val uri = FileProvider.getUriForFile(
                                        context,
                                        "${context.packageName}.fileprovider",
                                        file,
                                    )
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "application/octet-stream"
                                        putExtra(Intent.EXTRA_STREAM, uri)
                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    }
                                    context.startActivity(Intent.createChooser(intent, "Share SSC backup"))
                                } catch (_: Exception) {
                                    status = "Backup saved: ${file.absolutePath}"
                                }
                                status = "Backup exported"
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    },
                    enabled = backupPass.length >= 8,
                ) { Text("Export / share") }
                OutlinedButton(
                    onClick = { importBackup.launch("*/*") },
                    enabled = backupPass.length >= 8,
                ) { Text("Import") }
            }

            Spacer(Modifier.height(20.dp))
            Text("Linked devices", style = MaterialTheme.typography.titleMedium)
            deviceList.forEach { d ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("${d.name} (${d.platform})")
                        Text("id ${d.deviceId}", style = MaterialTheme.typography.bodySmall)
                    }
                    if (d.deviceId != session.deviceId) {
                        TextButton(onClick = {
                            scope.launch {
                                withContext(Dispatchers.IO) { devices.revoke(d.deviceId) }
                                refresh()
                            }
                        }) { Text("Revoke") }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text("Friend requests", style = MaterialTheme.typography.titleMedium)
            if (incoming.isEmpty()) {
                Text("No incoming requests", style = MaterialTheme.typography.bodySmall)
            }
            incoming.forEach { req ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text("From ${req.fromUserId}", Modifier.weight(1f))
                    TextButton(onClick = {
                        scope.launch {
                            withContext(Dispatchers.IO) { social.accept(req.id) }
                            refresh()
                        }
                    }) { Text("Accept") }
                    TextButton(onClick = {
                        scope.launch {
                            withContext(Dispatchers.IO) { social.decline(req.id) }
                            refresh()
                        }
                    }) { Text("Decline") }
                }
            }

            status?.let {
                Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 12.dp))
            }
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
            }

            Spacer(Modifier.height(20.dp))
            Text("Broadcast lists", style = MaterialTheme.typography.titleMedium)
            if (broadcastLists.isEmpty()) {
                Text(
                    "No lists yet. Create one with recipient user ids (comma-separated) below.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            broadcastLists.forEach { list ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("${list.name} (${list.recipientIds.size})", Modifier.weight(1f))
                    TextButton(onClick = { selectedBroadcast = list }) { Text("Send") }
                }
            }
            var newListName by remember { mutableStateOf("") }
            var newListRecipients by remember { mutableStateOf("") }
            OutlinedTextField(
                value = newListName,
                onValueChange = { newListName = it },
                label = { Text("New list name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            OutlinedTextField(
                value = newListRecipients,
                onValueChange = { newListRecipients = it },
                label = { Text("Recipient user ids (comma-separated)") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            Button(
                onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val ids = newListRecipients.split(",").map { it.trim() }.filter { it.isNotBlank() }
                                broadcast?.create(newListName, ids)
                            }
                            newListName = ""
                            newListRecipients = ""
                            refresh()
                            status = "Broadcast list created"
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                },
                enabled = broadcast != null && newListName.isNotBlank() && newListRecipients.isNotBlank(),
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Create list") }

            Spacer(Modifier.height(20.dp))
            Text("Storage", style = MaterialTheme.typography.titleMedium)
            OutlinedButton(
                onClick = {
                    db.clearAll()
                    status = "Local message cache cleared (crypto keys kept)"
                },
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Clear local message cache") }

            Spacer(Modifier.height(24.dp))
            Text("Danger zone", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
            Button(
                onClick = { showPanic = true },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Panic wipe") }

            Spacer(Modifier.height(24.dp))
            Text("About (free build)", style = MaterialTheme.typography.titleMedium)
            Text("${BuildConfig.SSC_CLIENT_IDENTITY} · native Compose")
            Text("versionName ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
            Text("API: ${BuildConfig.SSC_API_URL}", style = MaterialTheme.typography.bodySmall)
            Text(
                "Sideload APK only — no Play Store fee. See docs/FREE_DISTRIBUTION.md",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }

    selectedBroadcast?.let { list ->
        AlertDialog(
            onDismissRequest = { selectedBroadcast = null },
            title = { Text("Send to ${list.name}") },
            text = {
                OutlinedTextField(
                    value = broadcastMsg,
                    onValueChange = { broadcastMsg = it },
                    label = { Text("Message") },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try {
                            val n = withContext(Dispatchers.IO) {
                                broadcast?.sendToList(list, broadcastMsg.trim()) ?: 0
                            }
                            status = "Broadcast sent to $n recipient(s)"
                            broadcastMsg = ""
                            selectedBroadcast = null
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                }, enabled = broadcastMsg.isNotBlank()) { Text("Send") }
            },
            dismissButton = {
                TextButton(onClick = { selectedBroadcast = null }) { Text("Cancel") }
            },
        )
    }

    if (showPanic) {
        AlertDialog(
            onDismissRequest = { showPanic = false },
            title = { Text("Panic wipe?") },
            text = {
                Text(
                    "Deletes your account data on the server and all local crypto/messages on this device. This cannot be undone.",
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    try {
                                        auth.panicWipeServer()
                                    } catch (_: Exception) {
                                    }
                                    signal.wipeLocalCrypto()
                                    db.clearAll()
                                    session.clearSession()
                                }
                                showPanic = false
                                onPanicDone()
                            } catch (e: Exception) {
                                error = e.message
                                showPanic = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("Wipe everything") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showPanic = false }) { Text("Cancel") }
            },
        )
    }
}
