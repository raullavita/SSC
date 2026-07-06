import { fireEvent, render, screen } from '@testing-library/react';
import LinkedDevicesPanel from '../LinkedDevicesPanel';

jest.mock('../../lib/deviceLink', () => ({
  ...jest.requireActual('../../lib/deviceLink'),
  getLocalDeviceId: () => 'dev-current',
}));

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

  it('disables revoke for the current device', () => {
    render(
      <LinkedDevicesPanel
        devices={[
          { id: 'dev-current', name: 'This PC', platform: 'electron' },
          { id: 'dev-other', name: 'Phone', platform: 'android' },
        ]}
        linkSession={null}
        linkLabel="Tablet"
        onLinkLabelChange={() => {}}
        onCreateLink={() => {}}
        onRevoke={() => {}}
        loading={false}
        error={null}
      />
    );

    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    expect(revokeButtons[0]).toBeDisabled();
    expect(revokeButtons[1]).not.toBeDisabled();
  });

  it('calls onRevoke for other devices', () => {
    const onRevoke = jest.fn();
    render(
      <LinkedDevicesPanel
        devices={[
          { id: 'dev-current', name: 'This PC', platform: 'electron' },
          { id: 'dev-other', name: 'Phone', platform: 'android' },
        ]}
        linkSession={null}
        linkLabel="Tablet"
        onLinkLabelChange={() => {}}
        onCreateLink={() => {}}
        onRevoke={onRevoke}
        loading={false}
        error={null}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1]);
    expect(onRevoke).toHaveBeenCalledWith('dev-other');
  });
});