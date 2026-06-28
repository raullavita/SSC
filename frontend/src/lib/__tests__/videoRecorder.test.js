import {
  MAX_VIDEO_ATTACH_BYTES,
  MAX_VIDEO_DURATION_MS,
  MIN_VIDEO_BLOB_BYTES,
  pickVideoRecorderMime,
  resolveAttachmentMessageType,
  videoFilenameForMime,
} from '../videoRecorder';

describe('videoRecorder', () => {
  it('exports duration and size limits', () => {
    expect(MAX_VIDEO_DURATION_MS).toBe(60_000);
    expect(MIN_VIDEO_BLOB_BYTES).toBeGreaterThan(0);
    expect(MAX_VIDEO_ATTACH_BYTES).toBe(25 * 1024 * 1024);
  });

  it('picks empty mime when MediaRecorder missing', () => {
    const prev = global.MediaRecorder;
    global.MediaRecorder = undefined;
    expect(pickVideoRecorderMime()).toBe('');
    global.MediaRecorder = prev;
  });

  it('picks first supported video mime', () => {
    global.MediaRecorder = {
      isTypeSupported: (mime) => mime === 'video/webm;codecs=vp8,opus',
    };
    expect(pickVideoRecorderMime()).toBe('video/webm;codecs=vp8,opus');
  });

  it('maps mime to filename', () => {
    expect(videoFilenameForMime('video/mp4')).toBe('video.mp4');
    expect(videoFilenameForMime('video/webm')).toBe('video.webm');
  });

  it('resolves attachment message types', () => {
    expect(resolveAttachmentMessageType('image/png')).toBe('image');
    expect(resolveAttachmentMessageType('video/webm')).toBe('video');
    expect(resolveAttachmentMessageType('application/pdf')).toBe('file');
  });
});