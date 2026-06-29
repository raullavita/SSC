import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThreatModel from '../ThreatModel';

jest.mock('../../components/MarketingPage', () => function MarketingPage({ children }) {
  return <div data-testid="marketing-page">{children}</div>;
});

describe('ThreatModel', () => {
  it('renders public threat model headings and disclosure link', () => {
    render(
      <MemoryRouter>
        <ThreatModel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /threat model/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what we protect/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /honest limits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GitHub Security Advisories/i })).toHaveAttribute(
      'href',
      'https://github.com/raullavita/SSC/security/advisories/new',
    );
  });
});