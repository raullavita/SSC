import { render, screen } from '@testing-library/react';
import InstalledClientGate from '../InstalledClientGate';

describe('InstalledClientGate', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete window.sscCrypto;
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.__SSC_ANDROID_CLIENT;
    delete window.__SSC_NATIVE_BRIDGE;
  });

  it('renders children when libsignal is present in production crypto mode', () => {
    window.__SSC_NATIVE_BRIDGE = 'v1';
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

  it('allows installed electron platform in production crypto mode', () => {
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

  it('allows android shell marker in production crypto mode', () => {
    window.__SSC_ANDROID_SHELL = '1';
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

  it('allows installed shell with native bridge and libsignal', () => {
    window.__SSC_NATIVE_BRIDGE = 'v1';
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.0/8';
    window.sscCrypto = { encryptMessage: () => {}, decryptMessage: () => {} };
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


});