/**
 * WebRTC media acquisition with clear errors for calls (Step 11).
 */

export async function acquireCallMedia(video = false) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('media_not_supported');
    err.code = 'NotSupportedError';
    throw err;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: video
        ? {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
    });
  } catch (err) {
    const mapped = new Error(
      err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'permission_denied'
        : 'media_unavailable'
    );
    mapped.code = err?.name || 'MediaError';
    throw mapped;
  }
}

export function callErrorMessage(code) {
  switch (code) {
    case 'permission_denied':
      return 'Microphone or camera permission denied. Allow access in system settings.';
    case 'media_not_supported':
      return 'This device does not support voice/video calls.';
    case 'media_unavailable':
      return 'Could not access microphone or camera.';
    case 'peer_unavailable':
      return 'The other person is unavailable.';
    case 'connection_failed':
      return 'Connection failed. Check network or try again.';
    default:
      return 'Call could not be completed.';
  }
}