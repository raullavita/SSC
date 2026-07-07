package com.supersecurechat.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun RegisterScreen(
    viewModel: AuthViewModel,
    onNavigateLogin: () -> Unit,
    onAuthenticated: () -> Unit,
    onGoogleSignIn: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var displayName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var captchaToken by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(uiState.user) {
        if (uiState.user != null) {
            onAuthenticated()
            viewModel.consumeAuthenticatedUser()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Create account",
            style = MaterialTheme.typography.headlineLarge,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "End-to-end encrypted messaging",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = displayName,
            onValueChange = {
                displayName = it
                viewModel.clearError()
            },
            label = { Text("Display name") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = email,
            onValueChange = {
                email = it
                viewModel.clearError()
            },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = {
                password = it
                viewModel.clearError()
            },
            label = { Text("Password (8+ characters)") },
            singleLine = true,
            visualTransformation = if (showPassword) {
                VisualTransformation.None
            } else {
                PasswordVisualTransformation()
            },
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        imageVector = if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = if (showPassword) "Hide password" else "Show password",
                    )
                }
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = { viewModel.register(email, password, displayName, captchaToken) },
            ),
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
        )

        if (uiState.captchaRequired && !uiState.turnstileSiteKey.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(16.dp))
            TurnstileCaptcha(
                siteKey = uiState.turnstileSiteKey!!,
                onToken = { token ->
                    captchaToken = token
                    viewModel.clearError()
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        uiState.error?.let { error ->
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { viewModel.register(email, password, displayName, captchaToken) },
            enabled = !uiState.isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Create account")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedButton(
            onClick = onGoogleSignIn,
            enabled = !uiState.isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Continue with Google")
        }

        Spacer(modifier = Modifier.height(24.dp))
        TextButton(onClick = onNavigateLogin, enabled = !uiState.isLoading) {
            Text("Already have an account? Sign in")
        }
    }
}