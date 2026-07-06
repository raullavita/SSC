import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeviceLink from '../DeviceLink';

const mockLoadDevices = jest.fn();
const mockCreateLink = jest.fn();
const mockRevokeDevice = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'alice', display_name: 'Alice' },
    loading: false,
  }),
}));

jest.mock('../../devices/useMultiDevice', () => ({
  useMultiDevice: () => ({
    devices: [
      { id: 'dev-1', name: 'Phone', platform: 'android' },
      { id: 'dev-local', name: 'Desktop', platform: 'electron' },
    ],
    linkSession: null,
    createLink: mockCreateLink,
    confirmLink: jest.fn(),
    loadDevices: mockLoadDevices,
    revokeDevice: mockRevokeDevice,
    loading: false,
    error: null,
  }),
}));

jest.mock('../../lib/deviceLink', () => ({
  ...jest.requireActual('../../lib/deviceLink'),
  getLocalDeviceId: () => 'dev-local',
}));

jest.mock('../../components/LinkedDevicesPanel', () => function MockLinkedDevicesPanel(props) {
  return (
    <div>
      <button type="button" onClick={props.onCreateLink}>
        Generate QR link
      </button>
      {props.devices.map((device) => (
        <div key={device.id}>
          <span>{device.name}</span>
          <button type="button" onClick={() => props.onRevoke(device.id)}>
            Revoke {device.name}
          </button>
        </div>
      ))}
    </div>
  );
});

describe('DeviceLink page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  it('loads devices and renders linked device list', () => {
    render(
      <MemoryRouter>
        <DeviceLink />
      </MemoryRouter>
    );

    expect(mockLoadDevices).toHaveBeenCalled();
    expect(screen.getByText('Linked devices')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });

  it('creates a QR link from the panel', () => {
    render(
      <MemoryRouter>
        <DeviceLink />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate QR link' }));
    expect(mockCreateLink).toHaveBeenCalled();
  });

  it('revokes a device after confirmation', async () => {
    mockRevokeDevice.mockResolvedValue(true);

    render(
      <MemoryRouter>
        <DeviceLink />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Phone' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockRevokeDevice).toHaveBeenCalledWith('dev-1');
    expect(await screen.findByText('Device revoked')).toBeInTheDocument();
  });

  it('shows link-this-device flow when token is present', () => {
    render(
      <MemoryRouter initialEntries={['/link-device?token=abc123token456789']}>
        <DeviceLink />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Link this device' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link this device' })).toBeInTheDocument();
  });
});