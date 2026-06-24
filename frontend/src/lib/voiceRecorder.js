/**
 * Cross-platform voice note capture — fixes empty blobs on Electron/desktop
 * by using timesliced MediaRecorder + requestData() on stop.
 */

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
];

export function pickVoiceRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export function voiceFilenameForMime(mime) {
  if (mime.includes('ogg')) return 'voice.ogg';
  if (mime.includes('mp4') || mime.includes('aac')) return 'voice.m4a';
  return 'voice.webm';
}

const TIMESLICE_MS = 100;
export const MIN_VOICE_BLOB_BYTES = 500;

/**
 * Record from an open mic stream until stop() is called.
 * @returns {{ stop: () => void, done: Promise<{ blob: Blob, mimeType: string }> }}
 */
export function startVoiceRecording(stream) {
  const mimeType = pickVoiceRecorderMime();
  const options = mimeType ? { mimeType } : undefined;
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  let resolveDone;
  let rejectDone;

  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  recorder.ondataavailable = (e) => {
    if (e.data?.size > 0) chunks.push(e.data);
  };

  recorder.onerror = (e) => {
    rejectDone(e?.error || new Error('recording_failed'));
  };

  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    const type = recorder.mimeType || mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    resolveDone({ blob, mimeType: type });
  };

  recorder.start(TIMESLICE_MS);

  return {
    stop() {
      if (recorder.state === 'recording') {
        try { recorder.requestData(); } catch {}
        recorder.stop();
      }
    },
    done,
  };
}