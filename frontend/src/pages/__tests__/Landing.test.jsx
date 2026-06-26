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

jest.mock('../../lib/siteGate', () => ({
  isSiteUnderConstruction: jest.fn(() => false),
  hasSiteAccessBypass: jest.fn(() => true),
  setSiteAccessBypass: jest.fn(),
  tryUrlPreviewBypass: jest.fn(() => false),
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
    const logo = screen.getByTestId('ssc-logo');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveTextContent('Super Secure Chat');
    expect(screen.getByRole('link', { name: translate('landingLogin', 'en') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translate('landingRegister', 'en') })).toBeInTheDocument();
  });

  it('shows download panel in browser (no web chat)', () => {
    isInstalledClient.mockReturnValue(false);
    renderLanding();
    expect(screen.getByTestId('landing-download-panel')).toBeInTheDocument();
    expect(screen.getByText(translate('landingGetAndroid', 'en'))).toBeInTheDocument();
    expect(screen.getByTestId('landing-screenshots-section')).toBeInTheDocument();
    expect(screen.getByTestId('landing-contact-section')).toBeInTheDocument();
    expect(screen.getByTestId('landing-contact-email')).toHaveAttribute('href', 'mailto:contact@supersecurechat.com');
    expect(screen.queryByRole('link', { name: translate('landingLogin', 'en') })).not.toBeInTheDocument();
  });

  it('shows core feature highlights', () => {
    renderLanding();
    expect(screen.getByText(translate('landingFeatureE2eTitle', 'en'))).toBeInTheDocument();
    expect(screen.getByText(translate('landingFeature24hTitle', 'en'))).toBeInTheDocument();
    expect(screen.getByText(translate('landingFeaturePanicTitle', 'en'))).toBeInTheDocument();
  });
});