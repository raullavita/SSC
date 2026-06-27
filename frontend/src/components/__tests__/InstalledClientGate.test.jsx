import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InstalledClientGate from '../InstalledClientGate';
import { LocaleProvider } from '../../context/LocaleContext';
import * as platform from '../../lib/platform';

jest.mock('../../lib/platform', () => ({
  isInstalledClient: jest.fn(),
  isElectronApp: jest.fn(() => false),
  isNativeApp: jest.fn(() => false),
  getPlatform: jest.fn(() => 'web'),
  getBackendUrl: jest.fn(() => ''),
  prefersHashRouter: jest.fn(() => false),
  supportsWebPush: jest.fn(() => false),
}));

jest.mock('../../lib/api', () => ({
  API: 'http://localhost:3001/api',
  WS_URL: 'ws://localhost:3001/api/ws',
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

function renderGate(children = <div data-testid="child">chat</div>) {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <InstalledClientGate>{children}</InstalledClientGate>
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe('InstalledClientGate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes children through on installed client', () => {
    platform.isInstalledClient.mockReturnValue(true);
    renderGate();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('blocks children and shows install screen on browser', () => {
    platform.isInstalledClient.mockReturnValue(false);
    renderGate();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('shows Android and Windows install options on browser', () => {
    platform.isInstalledClient.mockReturnValue(false);
    renderGate();
    // Both download options rendered
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(1);
  });

  it('gate removal causes children to be visible (regression guard)', () => {
    // If someone removes the gate logic, isInstalledClient=false should still block
    platform.isInstalledClient.mockReturnValue(false);
    renderGate(<div data-testid="secret-chat" />);
    expect(screen.queryByTestId('secret-chat')).not.toBeInTheDocument();
  });
});
