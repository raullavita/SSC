import { render, screen } from '@testing-library/react';
import LinkedDevicesPanel from '../LinkedDevicesPanel';

jest.mock('../DeviceLinkQr', () => function MockDeviceLinkQr() {
  return <div data-testid="device-link-qr">QR</div>;
});

describe('LinkedDevicesPanel', () => {
  it('shows generate button and device list', () => {
    render(
      <LinkedDevicesPanel
        devices={[{ id: 'dev-1', name: 'Phone', platform: 'android' }]}
        linkSession={null}
        linkLabel="Tablet"
        onLinkLabelChange={() => {}}
        onCreateLink={() => {}}
        onRevoke={() => {}}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByRole('button', { name: 'Generate QR link' })).toBeInTheDocument();
    expect(screen.getByText(/Phone/)).toBeInTheDocument();
  });

  it('shows QR when link session active', () => {
    render(
      <LinkedDevicesPanel
        devices={[]}
        linkSession={{
          token: 'tok',
          expiresAt: Date.now() + 600000,
          maxDevices: 5,
        }}
        linkLabel="Tablet"
        onLinkLabelChange={() => {}}
        onCreateLink={() => {}}
        onRevoke={() => {}}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByTestId('device-link-qr')).toBeInTheDocument();
    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
  });
});