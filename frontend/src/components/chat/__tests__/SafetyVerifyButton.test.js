import { fireEvent, render, screen } from '@testing-library/react';
import SafetyVerifyButton from '../SafetyVerifyButton';

describe('SafetyVerifyButton', () => {
  test('renders verify label for unverified contact', () => {
    render(<SafetyVerifyButton trust={{ status: 'default' }} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Verify safety/i })).toBeInTheDocument();
  });

  test('calls onClick', () => {
    const onClick = jest.fn();
    render(<SafetyVerifyButton trust={{ status: 'changed' }} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Verify keys/i }));
    expect(onClick).toHaveBeenCalled();
  });
});