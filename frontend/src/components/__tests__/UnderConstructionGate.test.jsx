import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnderConstructionGate from '../UnderConstructionGate';
import { LocaleProvider } from '../../context/LocaleContext';
import { t as translate } from '../../lib/i18n';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../LanguagePicker', () => function LanguagePicker() {
  return <div data-testid="language-picker" />;
});

describe('UnderConstructionGate', () => {
  it('renders construction message and contact email', () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <UnderConstructionGate onBypass={jest.fn()} />
        </LocaleProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('under-construction-gate')).toBeInTheDocument();
    expect(screen.getByText(translate('constructionHeadline', 'en'))).toBeInTheDocument();
    expect(screen.getByTestId('construction-contact-email')).toHaveAttribute(
      'href',
      'mailto:contact@supersecurechat.com',
    );
  });

  it('requires confirmation before bypass', () => {
    const onBypass = jest.fn();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <UnderConstructionGate onBypass={onBypass} />
        </LocaleProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('construction-bypass-trigger'));
    expect(screen.getByTestId('construction-bypass-confirm')).toBeInTheDocument();
    expect(onBypass).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('construction-bypass-confirm-btn'));
    expect(onBypass).toHaveBeenCalledTimes(1);
  });
});