package com.supersecurechat.app.ui.settings

import androidx.activity.compose.BackHandler
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.supersecurechat.app.data.AuthRepository
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

/**
 * Product settings — no local backups, no raw user ids, no developer noise.
 * Disappearing messages default 24h (product design).
 */
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
    privacyRepo: PrivacyRepository? = null,
    onBack: () -> Unit,
    onPanicDone: () -> Unit,
) {
    var usernameDraft by remember { mutableStateOf(session.username ?: "") }
    var recoveryPass by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var deviceList by remember { mutableStateOf<List<DevicesRepository.Device>>(emptyList()) }
    var incoming by remember { mutableStateOf<List<SocialRepository.FriendRequest>>(emptyList()) }
    var showPanic by remember { mutableStateOf(false) }
    var disappearSec by remember {
        mutableStateOf(
            session.disappearingSecondsDefault.let {
                if (it == 0 && !session.username.isNullOrBlank()) SessionStore.DEFAULT_DISAPPEARING_SECONDS else it
            }.also {
                // First open after upgrade: force product default 24h if never set
                if (!session.isLoggedIn) return@also
            },
        )
    }
    var privacy by remember { mutableStateOf(PrivacyRepository.Settings()) }
    val scope = rememberCoroutineScope()

    BackHandler(onBack = onBack)

    fun refresh() {
        scope.launch {
            try {
                // Ensure default 24h if still 0 from older builds
                if (session.disappearingSecondsDefault == 0) {
                    session.disappearingSecondsDefault = SessionStore.DEFAULT_DISAPPEARING_SECONDS
                    disappearSec = SessionStore.DEFAULT_DISAPPEARING_SECONDS
                }
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
                privacy = withContext(Dispatchers.IO) {
                    privacyRepo?.get() ?: PrivacyRepository.Settings()
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
            Text(
                "Name: ${session.displayName ?: "—"}",
                style = MaterialTheme.typography.bodyLarge,
            )
            if (!session.username.isNullOrBlank()) {
                Text(
                    "Username: @${session.username}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(Modifier.height(12.dp))
            if (session.username.isNullOrBlank()) {
                OutlinedTextField(
                    value = usernameDraft,
                    onValueChange = { usernameDraft = it },
                    label = { Text("Choose a username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = {
                        scope.launch {
                            error = null
                            try {
                                val u = withContext(Dispatchers.IO) { users.setUsername(usernameDraft) }
                                session.username = u.username
                                status = "Username @${u.username} saved"
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

            Spacer(Modifier.height(24.dp))
            Text("Privacy", style = MaterialTheme.typography.titleMedium)
            Text(
                "Messages recycle automatically. Turning the timer off is the only way to keep chat history.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            Text(
                "Disappearing messages: ${
                    when {
                        disappearSec <= 0 -> "Off (history kept until deleted)"
                        disappearSec >= 86_400 -> "24 hours (default)"
                        disappearSec >= 3600 -> "${disappearSec / 3600} hour(s)"
                        else -> "$disappearSec seconds"
                    }
                }",
                style = MaterialTheme.typography.bodyMedium,
            )
            Row(Modifier.padding(top = 4.dp)) {
                listOf(
                    SessionStore.DEFAULT_DISAPPEARING_SECONDS to "24h",
                    3600 to "1h",
                    0 to "Off",
                ).forEach { (sec, label) ->
                    TextButton(onClick = {
                        disappearSec = sec
                        session.disappearingSecondsDefault = sec
                        status = "Disappearing: $label"
                    }) { Text(label) }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
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
                Text("Read receipts", Modifier.weight(1f))
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

            Spacer(Modifier.height(24.dp))
            Text("Friend requests", style = MaterialTheme.typography.titleMedium)
            Text(
                "You can only chat after both sides accept.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (incoming.isEmpty()) {
                Text("No pending requests", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
            }
            incoming.forEach { req ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text("Request from contact", Modifier.weight(1f))
                    TextButton(onClick = {
                        scope.launch {
                            withContext(Dispatchers.IO) { social.accept(req.id) }
                            status = "Accepted — chat unlocked"
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

            Spacer(Modifier.height(24.dp))
            Text("Account recovery", style = MaterialTheme.typography.titleMedium)
            Text(
                "Optional passphrase if you lose access to Google/email login. Not a chat backup.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = recoveryPass,
                onValueChange = { recoveryPass = it },
                label = { Text("Recovery passphrase") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
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
            ) { Text("Save recovery passphrase") }

            Spacer(Modifier.height(24.dp))
            Text("This device", style = MaterialTheme.typography.titleMedium)
            deviceList.forEach { d ->
                Text(
                    "${d.name} · ${d.platform}",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
            OutlinedButton(
                onClick = {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { signal.ensurePrekeysUploaded() }
                            status = "Encryption keys refreshed"
                        } catch (e: Exception) {
                            error = e.message
                        }
                    }
                },
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Refresh encryption keys") }

            status?.let {
                Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 16.dp))
            }
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
            }

            Spacer(Modifier.height(32.dp))
            Button(
                onClick = { showPanic = true },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Panic wipe (erase this device)") }
        }
    }

    if (showPanic) {
        AlertDialog(
            onDismissRequest = { showPanic = false },
            title = { Text("Erase this device?") },
            text = {
                Text("Wipes local session and message cache on this phone. This is not a chat export.")
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        withContext(Dispatchers.IO) {
                            try {
                                auth.logout()
                            } catch (_: Exception) {
                            }
                            db.clearAll()
                            session.clearSession()
                        }
                        showPanic = false
                        onPanicDone()
                    }
                }) { Text("Wipe") }
            },
            dismissButton = {
                TextButton(onClick = { showPanic = false }) { Text("Cancel") }
            },
        )
    }
}
