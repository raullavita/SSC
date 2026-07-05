import { render, screen } from '@testing-library/react';
import BackupPanel from '../BackupPanel';

describe('BackupPanel', () => {
  it('shows export and restore controls', () => {
    render(<BackupPanel userId="u1" onMessage={() => {}} />);
    expect(screen.getByRole('button', { name: 'Download encrypted backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore from backup' })).toBeInTheDocument();
    expect(screen.getByText(/never uploaded to SSC servers/i)).toBeInTheDocument();
  });
});