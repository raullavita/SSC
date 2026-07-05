import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock('../components/InstalledClientGate', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

jest.mock('../lib/appMode', () => ({
  isMarketingWebOnly: jest.fn(() => false),
  isInstalledApp: jest.fn(() => false),
  appVersionLabel: jest.fn(() => 'v0.3.0 (build 3)'),
}));

const appMode = require('../lib/appMode');

beforeEach(() => {
  appMode.isMarketingWebOnly.mockReturnValue(false);
  appMode.isInstalledApp.mockReturnValue(false);
});

test('renders SSC landing title on web', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('SSC')).toBeInTheDocument();
  expect(screen.getByText('Super Secure Chat')).toBeInTheDocument();
});

test('installed electron root shows sign-in, not marketing page', () => {
  appMode.isInstalledApp.mockReturnValue(true);
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByRole('tab', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Register' })).toBeInTheDocument();
  expect(screen.queryByText('Get the app')).not.toBeInTheDocument();
});