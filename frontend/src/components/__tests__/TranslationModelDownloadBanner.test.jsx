import React from 'react';
import { render, screen } from '@testing-library/react';
import TranslationModelDownloadBanner from '../TranslationModelDownloadBanner';

jest.mock('../../context/LocaleContext', () => ({
  useLocale: () => ({
    t: (key, vars = {}) => {
      const labels = {
        translateModelDownloading: 'Downloading on-device translation model (first use)',
        translateModelDownloadReady: 'Translation model ready',
        translateModelDownloadError: 'Translation model download failed — try again',
      };
      const text = labels[key] || key;
      return Object.entries(vars).reduce(
        (out, [name, value]) => out.replace(`{${name}}`, String(value)),
        text,
      );
    },
  }),
}));

function renderBanner(status) {
  return render(<TranslationModelDownloadBanner status={status} />);
}

describe('TranslationModelDownloadBanner', () => {
  it('renders nothing when idle', () => {
    renderBanner({ state: 'idle' });
    expect(screen.queryByTestId('translate-model-download-banner')).not.toBeInTheDocument();
  });

  it('shows download progress', () => {
    renderBanner({ state: 'downloading', percent: 37 });
    expect(screen.getByTestId('translate-model-download-banner')).toBeInTheDocument();
    expect(screen.getByTestId('translate-model-download-percent')).toHaveTextContent('37%');
    expect(screen.getByTestId('translate-model-download-bar').firstChild).toHaveStyle({ width: '37%' });
  });

  it('shows error state', () => {
    renderBanner({ state: 'error' });
    expect(screen.getByTestId('translate-model-download-banner')).toHaveTextContent(
      'Translation model download failed',
    );
    expect(screen.queryByTestId('translate-model-download-percent')).not.toBeInTheDocument();
  });
});