import { prefixSelectionAsList, wrapSelectionWithMarkers } from '../composerFormatting';

describe('composerFormatting', () => {
  it('wraps selection with markers', () => {
    const out = wrapSelectionWithMarkers('hello world', 6, 11, '**');
    expect(out.value).toBe('hello **world**');
    expect(out.selectionStart).toBe(out.value.length);
  });

  it('prefixes lines as bullet list', () => {
    const out = prefixSelectionAsList('alpha\nbeta', 0, 9, false);
    expect(out.value).toBe('- alpha\n- beta');
  });
});