package com.supersecurechat.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.supersecurechat.app.data.repository.AuthRepository
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    authRepository: AuthRepository,
    onLoggedOut: () -> Unit,
) {
    var displayName by remember { mutableStateOf<String?>(null) }
    var isLoggingOut by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        displayName = runCatching { authRepository.refreshCurrentUser()?.displayName }.getOrNull()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "You're signed in",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = displayName?.let { "Welcome, $it" } ?: "Loading profile…",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Native SSC foundation is ready. Chat and encryption arrive in Phase 2.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(32.dp))
        OutlinedButton(
            onClick = {
                isLoggingOut = true
                scope.launch {
                    runCatching { authRepository.logout() }
                    isLoggingOut = false
                    onLoggedOut()
                }
            },
            enabled = !isLoggingOut,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (isLoggingOut) "Signing out…" else "Sign out")
        }
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { },
            enabled = false,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Chats (Phase 2)")
        }
    }
}