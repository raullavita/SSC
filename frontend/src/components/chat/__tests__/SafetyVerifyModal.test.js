import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SafetyVerifyModal from '../SafetyVerifyModal';

jest.mock('../SafetyQr', () => function MockSafetyQr() {
  return <div data-testid="safety-qr">QR</div>;
});

describe('SafetyVerifyModal', () => {
  it('shows verified badge and reset action', async () => {
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        trust={{ status: 'verified', safetyNumber: '1234 5678' }}
        safetyNumber={{ displayable: '1234 5678' }}
        onClose={() => {}}
        onMarkVerified={() => {}}
        onResetTrust={() => {}}
      />
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset verification' })).toBeInTheDocument();
  });

  it('calls mark verified for unverified contact', () => {
    const onMarkVerified = jest.fn();
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        trust={{ status: 'default' }}
        safetyNumber={{ displayable: '1234 5678' }}
        onClose={() => {}}
        onMarkVerified={onMarkVerified}
        onResetTrust={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as verified' }));
    expect(onMarkVerified).toHaveBeenCalled();
  });
});