import { detectLanguage, shouldAutoTranslate } from '../languageDetect';

describe('languageDetect', () => {
  it('detects English text', () => {
    expect(detectLanguage('Hello, this is a longer English sentence for testing.')).toBe('en');
  });

  it('skips very short text', () => {
    expect(detectLanguage('hi')).toBeNull();
  });

  it('shouldAutoTranslate when languages differ', () => {
    const text = 'Bonjour, comment allez-vous aujourd hui mon ami';
    expect(shouldAutoTranslate(text, 'en')).toBe(true);
  });
});