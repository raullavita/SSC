import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppLockGate from '../AppLockGate';

jest.mock('../../context/LocaleContext', () => ({
  useLocale: () => ({
    t: (key) => ({
      appLockTitle: 'SSC is locked',
      appLockSubtitle: 'Enter your PIN',
      appLockPinPlaceholder: 'PIN',
      appLockUnlock: 'Unlock',
      appLockWrongPin: 'Wrong PIN',
      appLockUseBiometric: 'Use biometrics',
      appLockBiometricFailed: 'Biometric failed',
    })[key] || key,
  }),
}));

const mockUnlockWithPin = jest.fn();
const mockUnlockWithBiometric = jest.fn();

jest.mock('../../context/AppLockContext', () => ({
  useAppLock: () => ({
    unlockWithPin: mockUnlockWithPin,
    unlockWithBiometric: mockUnlockWithBiometric,
    biometricAvailable: false,
    biometricEnabled: false,
  }),
}));

describe('AppLockGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnlockWithPin.mockResolvedValue(true);
  });

  it('renders pin gate', () => {
    render(<AppLockGate />);
    expect(screen.getByTestId('app-lock-gate')).toBeInTheDocument();
    expect(screen.getByTestId('app-lock-pin-input')).toBeInTheDocument();
  });

  it('submits pin to unlock', async () => {
    render(<AppLockGate />);
    fireEvent.change(screen.getByTestId('app-lock-pin-input'), { target: { value: '1234' } });
    fireEvent.click(screen.getByTestId('app-lock-unlock-button'));
    await waitFor(() => {
      expect(mockUnlockWithPin).toHaveBeenCalledWith('1234');
    });
  });
});