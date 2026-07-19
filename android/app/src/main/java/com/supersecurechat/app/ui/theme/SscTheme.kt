package com.supersecurechat.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// WhatsApp-adjacent dark palette (SSC previous shell tones)
private val SscDark = darkColorScheme(
    primary = Color(0xFF00A884),
    onPrimary = Color(0xFF041510),
    secondary = Color(0xFF53BDEB),
    background = Color(0xFF0B141A),
    onBackground = Color(0xFFE9EDEF),
    surface = Color(0xFF111B21),
    onSurface = Color(0xFFE9EDEF),
    surfaceVariant = Color(0xFF202C33),
    onSurfaceVariant = Color(0xFF8696A0),
    outline = Color(0xFF3B4A54),
    error = Color(0xFFEA4335),
)

private val SscLight = lightColorScheme(
    primary = Color(0xFF008069),
    onPrimary = Color.White,
    secondary = Color(0xFF027EB5),
    background = Color(0xFFF0F2F5),
    onBackground = Color(0xFF111B21),
    surface = Color.White,
    onSurface = Color(0xFF111B21),
    surfaceVariant = Color(0xFFE9EDEF),
    onSurfaceVariant = Color(0xFF667781),
    outline = Color(0xFFD1D7DB),
    error = Color(0xFFEA4335),
)

@Composable
fun SscTheme(
    darkTheme: Boolean = isSystemInDarkTheme() || true,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) SscDark else SscLight,
        content = content,
    )
}
