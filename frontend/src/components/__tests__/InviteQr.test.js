import { render, screen } from '@testing-library/react';
import InviteQr from '../InviteQr';

jest.mock('../DeviceLinkQr', () => ({ url, label }) => (
  <div data-testid="device-link-qr">
    {url}:{label}
  </div>
));

describe('InviteQr', () => {
  it('builds invite URL and passes it to DeviceLinkQr', () => {
    render(<InviteQr username="alice" />);

    expect(screen.getByTestId('device-link-qr')).toHaveTextContent(
      'https://www.supersecurechat.com/add/alice:Scan to add me on SSC'
    );
  });

  it('passes null url when username is missing', () => {
    render(<InviteQr username="" />);
    expect(screen.getByTestId('device-link-qr')).toHaveTextContent(':Scan to add me on SSC');
  });
});