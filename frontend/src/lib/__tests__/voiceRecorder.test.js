import {
  MIN_VOICE_BLOB_BYTES,
  pickVoiceRecorderMime,
  voiceFilenameForMime,
} from '../voiceRecorder';

describe('voiceRecorder', () => {
  it('exports minimum blob threshold', () => {
    expect(MIN_VOICE_BLOB_BYTES).toBeGreaterThan(0);
  });

  it('picks empty mime when MediaRecorder missing', () => {
    const prev = global.MediaRecorder;
    // eslint-disable-next-line no-global-assign
    global.MediaRecorder = undefined;
    expect(pickVoiceRecorderMime()).toBe('');
    global.MediaRecorder = prev;
  });

  it('picks first supported mime type', () => {
    global.MediaRecorder = {
      isTypeSupported: (mime) => mime === 'audio/webm;codecs=opus',
    };
    expect(pickVoiceRecorderMime()).toBe('audio/webm;codecs=opus');
  });

  it('maps mime to filename', () => {
    expect(voiceFilenameForMime('audio/ogg;codecs=opus')).toBe('voice.ogg');
    expect(voiceFilenameForMime('audio/mp4')).toBe('voice.m4a');
    expect(voiceFilenameForMime('audio/webm')).toBe('voice.webm');
  });
});