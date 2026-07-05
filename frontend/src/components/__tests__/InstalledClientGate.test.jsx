import { render, screen } from '@testing-library/react';
import InstalledClientGate from '../InstalledClientGate';

describe('InstalledClientGate', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete window.sscCrypto;
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.__SSC_ANDROID_CLIENT;
  });

  it('renders children when libsignal is present in production crypto mode', () => {
    window.sscCrypto = { encryptMessage: () => {}, decryptMessage: () => {} };
    process.env = {
      ...originalEnv,
      REACT_APP_SSC_REQUIRE_LIBCRYPTO: 'true',
      NODE_ENV: 'production',
    };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.getByText('chat-ui')).toBeInTheDocument();
  });

  it('allows electron shell when platform is electron even before libsignal warms up', () => {
    process.env = {
      ...originalEnv,
      REACT_APP_SSC_REQUIRE_LIBCRYPTO: 'true',
      REACT_APP_SSC_PLATFORM: 'electron',
      NODE_ENV: 'production',
    };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.getByText('chat-ui')).toBeInTheDocument();
  });

  it('allows electron shell via runtime client marker', () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.0/4';
    process.env = {
      ...originalEnv,
      REACT_APP_SSC_REQUIRE_LIBCRYPTO: 'true',
      REACT_APP_SSC_PLATFORM: 'web',
      NODE_ENV: 'production',
    };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.getByText('chat-ui')).toBeInTheDocument();
  });

  it('renders children for electron platform in non-crypto-strict dev builds', () => {
    process.env = {
      ...originalEnv,
      REACT_APP_SSC_PLATFORM: 'electron',
      NODE_ENV: 'production',
    };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.getByText('chat-ui')).toBeInTheDocument();
  });

  it('blocks plain browser in production without allowed platform', () => {
    process.env = {
      ...originalEnv,
      REACT_APP_SSC_PLATFORM: 'browser',
      NODE_ENV: 'production',
    };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.queryByText('chat-ui')).not.toBeInTheDocument();
    expect(screen.getByText(/installed Android or Windows app/i)).toBeInTheDocument();
  });
});