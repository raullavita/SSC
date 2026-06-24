import { formatFileSize, filenameFromCaption, isImageMime } from '../attachmentUtils';

describe('attachmentUtils', () => {
  it('formats byte sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('extracts filename from caption', () => {
    expect(filenameFromCaption('report.pdf')).toBe('report.pdf');
    expect(filenameFromCaption('  ')).toBe('attachment');
    expect(filenameFromCaption(null, 'file.bin')).toBe('file.bin');
  });

  it('detects image mime types', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('application/pdf')).toBe(false);
  });
});