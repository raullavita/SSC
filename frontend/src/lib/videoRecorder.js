/**
 * Short video clip capture — Q.21 (hold-to-record, max duration cap).
 */

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

const TIMESLICE_MS = 100;
export const MAX_VIDEO_DURATION_MS = 60_000;
export const MIN_VIDEO_BLOB_BYTES = 2000;
export const MAX_VIDEO_ATTACH_BYTES = 25 * 1024 * 1024;

export function pickVideoRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of VIDEO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export function videoFilenameForMime(mime) {
  if (mime.includes('mp4')) return 'video.mp4';
  return 'video.webm';
}

export function resolveAttachmentMessageType(mimeType = '') {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/gif') return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/**
 * Record from camera+mic until stop() or max duration.
 * @returns {{ stop: () => void, done: Promise<{ blob: Blob, mimeType: string }>, stream: MediaStream }}
 */
export function startVideoRecording(stream, { maxDurationMs = MAX_VIDEO_DURATION_MS, onMaxDuration } = {}) {
  const mimeType = pickVideoRecorderMime();
  const options = mimeType ? { mimeType } : undefined;
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  let resolveDone;
  let rejectDone;
  let maxTimer = null;

  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const stop = () => {
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    if (recorder.state === 'recording') {
      try { recorder.requestData(); } catch { /* ignore */ }
      recorder.stop();
    }
  };

  recorder.ondataavailable = (e) => {
    if (e.data?.size > 0) chunks.push(e.data);
  };

  recorder.onerror = (e) => {
    if (maxTimer) clearTimeout(maxTimer);
    rejectDone(e?.error || new Error('recording_failed'));
  };

  recorder.onstop = () => {
    if (maxTimer) clearTimeout(maxTimer);
    stream.getTracks().forEach((t) => t.stop());
    const type = recorder.mimeType || mimeType || 'video/webm';
    const blob = new Blob(chunks, { type });
    resolveDone({ blob, mimeType: type });
  };

  recorder.start(TIMESLICE_MS);

  if (maxDurationMs > 0) {
    maxTimer = setTimeout(() => {
      onMaxDuration?.();
      stop();
    }, maxDurationMs);
  }

  return { stop, done, stream };
}