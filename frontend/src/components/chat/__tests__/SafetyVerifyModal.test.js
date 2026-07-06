import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SafetyVerifyModal from '../SafetyVerifyModal';

jest.mock('../SafetyQr', () => function MockSafetyQr() {
  return <div data-testid="safety-qr">QR</div>;
});

const SAMPLE = '12345 67890 11111 22222 33333 44444';

describe('SafetyVerifyModal', () => {
  it('shows verified badge and reset action', () => {
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        peerLabel="Alice"
        trust={{ status: 'verified', safetyNumber: SAMPLE }}
        safetyNumber={{ displayable: SAMPLE }}
        onClose={() => {}}
        onMarkVerified={() => {}}
        onResetTrust={() => {}}
      />
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset verification' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as verified' })).not.toBeInTheDocument();
  });

  it('requires compare confirmation before mark verified', () => {
    const onMarkVerified = jest.fn();
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        trust={{ status: 'default' }}
        safetyNumber={{ displayable: SAMPLE }}
        onClose={() => {}}
        onMarkVerified={onMarkVerified}
        onResetTrust={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: 'Mark as verified' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as verified' }));
    expect(onMarkVerified).toHaveBeenCalled();
  });

  it('enables mark verified when pasted number matches', () => {
    const onMarkVerified = jest.fn();
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        trust={{ status: 'default' }}
        safetyNumber={{ displayable: SAMPLE }}
        onClose={() => {}}
        onMarkVerified={onMarkVerified}
        onResetTrust={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText(/Paste their safety number/i), {
      target: { value: '123456789011111222223333344444' },
    });
    expect(screen.getByText('Numbers match.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as verified' }));
    expect(onMarkVerified).toHaveBeenCalled();
  });

  it('shows digit groups and QR', () => {
    render(
      <SafetyVerifyModal
        open
        peerId="u_peer"
        trust={{ status: 'default' }}
        safetyNumber={{ displayable: SAMPLE }}
        onClose={() => {}}
        onMarkVerified={() => {}}
        onResetTrust={() => {}}
      />
    );
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByTestId('safety-qr')).toBeInTheDocument();
  });
});