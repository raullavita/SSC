import { fireEvent, render, screen } from '@testing-library/react';
import TrustBanner from '../TrustBanner';

describe('TrustBanner', () => {
  it('renders nothing when trust is default', () => {
    const { container } = render(
      <TrustBanner trust={{ status: 'default' }} onVerify={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows warning when key changed', () => {
    const onVerify = jest.fn();
    render(<TrustBanner trust={{ status: 'changed' }} onVerify={onVerify} />);
    expect(screen.getByText('Safety number changed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onVerify).toHaveBeenCalled();
  });
});