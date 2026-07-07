package com.supersecurechat.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val SscColorScheme = darkColorScheme(
    primary = SscAccent,
    onPrimary = SscBackground,
    background = SscBackground,
    onBackground = SscText,
    surface = SscSurface,
    onSurface = SscText,
    surfaceVariant = SscSurface,
    onSurfaceVariant = SscMuted,
    error = SscError,
    onError = SscText,
    outline = SscMuted,
)

@Composable
fun SscTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = SscBackground.toArgb()
            window.navigationBarColor = SscBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = SscColorScheme,
        typography = SscTypography,
        content = content,
    )
}