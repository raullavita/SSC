import { detectLanguage, shouldAutoTranslate } from '../languageDetect';

describe('languageDetect', () => {
  it('detects English for a long English sentence', () => {
    expect(detectLanguage('This is a longer English sentence for detection.')).toBe('en');
  });

  it('shouldAutoTranslate when detected language differs from user language', () => {
    const text = 'Bonjour tout le monde comment allez vous aujourd hui';
    expect(shouldAutoTranslate(text, 'en')).toBe(true);
  });
});