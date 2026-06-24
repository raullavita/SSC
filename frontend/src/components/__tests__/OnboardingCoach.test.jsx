import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingCoach, {
  hasCompletedOnboarding,
  markOnboardingComplete,
  onboardingStorageKey,
} from '../OnboardingCoach';

jest.mock('../../context/LocaleContext', () => ({
  useLocale: () => ({
    t: (key) => key,
  }),
}));

describe('OnboardingCoach', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows first step when open', () => {
    render(<OnboardingCoach open userId="u_test" onComplete={jest.fn()} />);
    expect(screen.getByTestId('onboarding-coach')).toBeInTheDocument();
    expect(screen.getByText('onboardingStep1Title')).toBeInTheDocument();
  });

  it('marks complete on finish', () => {
    const onComplete = jest.fn();
    render(<OnboardingCoach open userId="u_test" onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    expect(hasCompletedOnboarding('u_test')).toBe(true);
    expect(onComplete).toHaveBeenCalled();
  });

  it('storage key is per user', () => {
    markOnboardingComplete('u_a');
    expect(hasCompletedOnboarding('u_a')).toBe(true);
    expect(hasCompletedOnboarding('u_b')).toBe(false);
    expect(onboardingStorageKey('u_a')).toBe('ssc_onboarding_v1_u_a');
  });
});