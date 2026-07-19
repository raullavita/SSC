package com.supersecurechat.app.ui.call

import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.supersecurechat.app.data.CallCoordinator
import org.webrtc.SurfaceViewRenderer

@Composable
fun CallOverlay(
    state: CallCoordinator.UiState,
    onAnswer: () -> Unit,
    onDecline: () -> Unit,
    onHangup: () -> Unit,
    onToggleMic: (() -> Unit)? = null,
    onToggleCam: (() -> Unit)? = null,
    callCoord: CallCoordinator? = null,
) {
    if (state.status == "idle") return

    val showVideoTiles = state.status in setOf("connecting", "connected", "ringing") &&
        (state.video || state.camEnabled || state.remoteVideo)

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.98f))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (state.status) {
            "incoming" -> {
                Text(
                    if (state.mode == "sfu") "Incoming group call (SFU)" else "Incoming call",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "From ${state.incoming?.fromUserId ?: state.peerId ?: "…"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (state.video) {
                    Text("Video", style = MaterialTheme.typography.bodySmall)
                }
                state.sfuRoomId?.let {
                    Text(
                        "SFU room ready",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Row(
                    Modifier.padding(top = 12.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    OutlinedButton(onClick = onDecline) { Text("Decline") }
                    Button(onClick = onAnswer) { Text("Answer") }
                }
            }
            "ringing", "connecting", "connected" -> {
                Text(
                    when {
                        state.status == "ringing" -> "Calling…"
                        state.status == "connecting" && state.mode == "sfu" -> "Joining SFU…"
                        state.status == "connecting" -> "Connecting…"
                        state.mode == "sfu" -> "In group call (SFU)"
                        else -> "In call"
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                state.peerId?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall)
                }
                state.sfuRoomId?.let {
                    Text(
                        "Room ${it.take(12)}…",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (showVideoTiles && callCoord != null) {
                    CallVideoTiles(
                        callCoord = callCoord,
                        showLocal = state.camEnabled || state.video,
                        showRemote = state.remoteVideo || state.status == "connected",
                    )
                }

                val mediaBits = buildList {
                    if (state.remoteAudio) add("remote audio")
                    if (state.remoteVideo) add("remote video")
                    if (state.video || state.camEnabled) add("cam on")
                    if (!state.micEnabled) add("muted")
                }
                if (mediaBits.isNotEmpty()) {
                    Text(
                        mediaBits.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Row(
                    Modifier.padding(top = 12.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (onToggleMic != null) {
                        TextButton(onClick = onToggleMic) {
                            Text(if (state.micEnabled) "Mute" else "Unmute")
                        }
                    }
                    if (onToggleCam != null) {
                        TextButton(onClick = onToggleCam) {
                            Text(if (state.camEnabled) "Cam off" else "Cam on")
                        }
                    }
                    Button(
                        onClick = onHangup,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                        ),
                    ) { Text("End call") }
                }
            }
            else -> {
                state.error?.let {
                    val label = when (it) {
                        "no_answer" -> "No answer"
                        "busy" -> "Busy"
                        "call_failed" -> "Call failed"
                        "sfu_required_unavailable" -> "SFU required but unavailable"
                        else -> it
                    }
                    Text(label, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun CallVideoTiles(
    callCoord: CallCoordinator,
    showLocal: Boolean,
    showRemote: Boolean,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (showRemote) {
            Box(
                Modifier
                    .weight(1f)
                    .aspectRatio(3f / 4f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .height(180.dp),
            ) {
                VideoSurface(
                    modifier = Modifier.fillMaxWidth().height(180.dp),
                    onReady = { callCoord.bindRemoteVideo(it) },
                )
                Text(
                    "Remote",
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(6.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                )
            }
        }
        if (showLocal) {
            Box(
                Modifier
                    .weight(1f)
                    .aspectRatio(3f / 4f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .height(160.dp),
            ) {
                VideoSurface(
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                    onReady = { callCoord.bindLocalVideo(it) },
                )
                Text(
                    "You",
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(6.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun VideoSurface(
    modifier: Modifier = Modifier,
    onReady: (SurfaceViewRenderer) -> Unit,
    onDisposeSurface: () -> Unit = {},
) {
    AndroidView(
        factory = { ctx ->
            SurfaceViewRenderer(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                setZOrderMediaOverlay(true)
                onReady(this)
            }
        },
        modifier = modifier,
        onRelease = { view ->
            try {
                onDisposeSurface()
                view.release()
            } catch (_: Exception) {
            }
        },
    )
}
