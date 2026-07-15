import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../Settings';
import { api } from '../../lib/api';

const mockLogout = jest.fn();
const mockUser = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: mockLogout,
  }),
}));

jest.mock('../../lib/presence', () => ({
  updatePrivacySettings: jest.fn(() =>
    Promise.resolve({ privacy_settings: { read_receipts: true } })
  ),
}));

jest.mock('../../lib/translation', () => ({
  DEFAULT_LANGUAGES: ['en', 'es'],
  getTranslationProviderStatus: () => ({
    onDevice: 'disabled',
    userApiKey: 'disabled',
    localLibre: 'disabled',
    serverProxy: 'coming_soon',
  }),
}));

jest.mock('../../components/AbuseReportPanel', () => () => null);
jest.mock('../../components/BackupPanel', () => () => null);
jest.mock('../../components/RecoveryPanel', () => () => null);
jest.mock('../../components/InviteQr', () => ({ username }) => (
  <div data-testid="invite-qr">QR for @{username}</div>
));

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(api, 'get').mockResolvedValue({ privacy_settings: { read_receipts: false } });
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(() => Promise.resolve()) },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders profile and invite actions for users with a username', () => {
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument();
    expect(screen.getByTestId('invite-qr')).toHaveTextContent('QR for @alice');
  });

  it('copies invite link to clipboard', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://www.supersecurechat.com/add/alice'
    );
    expect(await screen.findByText('Invite link copied')).toBeInTheDocument();
  });

  it('renders chat preference section', () => {
    renderSettings();

    expect(screen.getByText('Chat & notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Sealed sender')).toBeInTheDocument();
  });

  it('calls logout when log out is clicked', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(mockLogout).toHaveBeenCalled();
  });
});