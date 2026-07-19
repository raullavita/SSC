package com.supersecurechat.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.supersecurechat.app.data.AuthRepository
import com.supersecurechat.app.data.SscHttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun RecoveryScreen(
    auth: AuthRepository,
    onRecovered: () -> Unit,
    onBack: () -> Unit,
) {
    androidx.activity.compose.BackHandler(onBack = onBack)
    var email by remember { mutableStateOf("") }
    var passphrase by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var recoveryToken by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var captchaSiteKey by remember { mutableStateOf<String?>(null) }
    var captchaRequired by remember { mutableStateOf(false) }
    var captchaToken by remember { mutableStateOf("") }
    var captchaReset by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val cfg = withContext(Dispatchers.IO) { auth.publicConfig() }
            captchaRequired = cfg.captchaRequired
            captchaSiteKey = cfg.turnstileSiteKey
        } catch (_: Exception) {
            captchaRequired = true
        }
    }

    val needsCaptcha = recoveryToken == null && captchaRequired && !captchaSiteKey.isNullOrBlank()
    val canVerify = email.isNotBlank() && passphrase.length >= 8 &&
        (!needsCaptcha || captchaToken.isNotBlank())

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Account recovery", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = passphrase,
            onValueChange = { passphrase = it },
            label = { Text("Recovery passphrase") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        if (recoveryToken != null) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("New password") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        } else if (needsCaptcha) {
            Spacer(Modifier.height(12.dp))
            Text("Security check", style = MaterialTheme.typography.labelMedium)
            TurnstileWebView(
                siteKey = captchaSiteKey!!,
                onToken = { captchaToken = it },
                resetKey = captchaReset,
            )
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        Spacer(Modifier.height(16.dp))
        if (loading) {
            CircularProgressIndicator()
        } else if (recoveryToken == null) {
            Button(
                onClick = {
                    loading = true
                    error = null
                    scope.launch {
                        try {
                            recoveryToken = withContext(Dispatchers.IO) {
                                auth.verifyRecovery(
                                    email,
                                    passphrase,
                                    captchaToken = captchaToken.ifBlank { null },
                                )
                            }
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                            captchaToken = ""
                            captchaReset++
                        } catch (e: Exception) {
                            error = e.message
                            captchaToken = ""
                            captchaReset++
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = canVerify,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Verify recovery") }
        } else {
            Button(
                onClick = {
                    loading = true
                    error = null
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                auth.resetPasswordWithRecovery(recoveryToken!!, newPassword)
                            }
                            onRecovered()
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                        } catch (e: Exception) {
                            error = e.message
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = newPassword.length >= 8,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Reset password & sign in") }
        }
        TextButton(onClick = onBack) { Text("Back to login") }
    }
}
