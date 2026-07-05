import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InstalledAppEntry from '../InstalledAppEntry';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require('../../context/AuthContext');

describe('InstalledAppEntry', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  test('shows splash while auth is loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    render(
      <MemoryRouter>
        <InstalledAppEntry />
      </MemoryRouter>
    );
    expect(screen.getByText('Securing your session…')).toBeInTheDocument();
  });

  test('redirects logged-out users to login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={['/']}>
        <InstalledAppEntry />
      </MemoryRouter>
    );
    expect(screen.queryByText('Get the app')).not.toBeInTheDocument();
  });
});