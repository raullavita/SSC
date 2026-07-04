import { render, screen } from '@testing-library/react';
import InstalledClientGate from '../InstalledClientGate';

describe('InstalledClientGate', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders children for electron platform', () => {
    process.env = { ...originalEnv, REACT_APP_SSC_PLATFORM: 'electron', NODE_ENV: 'production' };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.getByText('chat-ui')).toBeInTheDocument();
  });

  it('blocks plain browser in production without allowed platform', () => {
    process.env = { ...originalEnv, REACT_APP_SSC_PLATFORM: 'browser', NODE_ENV: 'production' };
    render(
      <InstalledClientGate>
        <span>chat-ui</span>
      </InstalledClientGate>
    );
    expect(screen.queryByText('chat-ui')).not.toBeInTheDocument();
    expect(screen.getByText(/installed Android or Windows app/i)).toBeInTheDocument();
  });
});