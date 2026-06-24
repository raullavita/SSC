import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../Landing';
import { LocaleProvider } from '../../context/LocaleContext';
import { t as translate } from '../../lib/i18n';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../../components/LanguagePicker', () => function LanguagePicker() {
  return <div data-testid="language-picker" />;
});

jest.mock('../../lib/platform', () => ({
  isInstalledClient: jest.fn(() => true),
}));

const { isInstalledClient } = require('../../lib/platform');

function renderLanding() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <Landing />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe('Landing', () => {
  beforeEach(() => {
    isInstalledClient.mockReturnValue(true);
  });

  it('renders SSC branding and primary CTAs on installed clients', () => {
    renderLanding();
    expect(screen.getByTestId('ssc-logo')).toBeInTheDocument();
    expect(screen.getByText('SSC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translate('landingLogin', 'en') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translate('landingRegister', 'en') })).toBeInTheDocument();
  });

  it('shows download panel in browser (no web chat)', () => {
    isInstalledClient.mockReturnValue(false);
    renderLanding();
    expect(screen.getByTestId('landing-download-panel')).toBeInTheDocument();
    expect(screen.getByText(translate('landingGetAndroid', 'en'))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: translate('landingLogin', 'en') })).not.toBeInTheDocument();
  });

  it('shows core feature highlights', () => {
    renderLanding();
    expect(screen.getByText(translate('landingFeatureE2eTitle', 'en'))).toBeInTheDocument();
    expect(screen.getByText(translate('landingFeature24hTitle', 'en'))).toBeInTheDocument();
    expect(screen.getByText(translate('landingFeaturePanicTitle', 'en'))).toBeInTheDocument();
  });
});