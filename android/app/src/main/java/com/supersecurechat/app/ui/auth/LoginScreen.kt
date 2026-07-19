package com.supersecurechat.app.ui.auth

import android.app.Activity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.supersecurechat.app.SscOAuthLauncher
import com.supersecurechat.app.data.AuthRepository
import com.supersecurechat.app.data.SscHttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun LoginScreen(
    auth: AuthRepository,
    onLoggedIn: () -> Unit,
    onRecovery: () -> Unit = {},
) {
    val context = LocalContext.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var registerMode by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "SSC",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = if (registerMode) "Create account" else "Sign in",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
        )

        if (registerMode) {
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Display name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )

        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 12.dp),
            )
        }

        Spacer(Modifier.height(20.dp))

        if (loading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = {
                    loading = true
                    error = null
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                if (registerMode) {
                                    auth.register(
                                        email,
                                        password,
                                        displayName.ifBlank { email.substringBefore("@") },
                                    )
                                } else {
                                    auth.login(email, password)
                                }
                            }
                            onLoggedIn()
                        } catch (e: SscHttpClient.ApiException) {
                            error = e.detail
                        } catch (e: Exception) {
                            error = e.message ?: "login_failed"
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = email.isNotBlank() && password.length >= 8,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (registerMode) "Register" else "Sign in")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    val activity = context as? Activity
                    if (activity != null) {
                        SscOAuthLauncher.launchCustomTab(activity, auth.googleStartUrl())
                    } else {
                        error = "oauth_activity_unavailable"
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Continue with Google")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    registerMode = !registerMode
                    error = null
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (registerMode) "Have an account? Sign in" else "Need an account? Register")
            }
            TextButton(onClick = onRecovery) {
                Text("Account recovery")
            }
        }

        Text(
            text = "Native Android · no WebView",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 24.dp),
        )
    }
}
