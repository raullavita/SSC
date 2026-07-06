import { fireEvent, render, screen } from '@testing-library/react';
import ReadReceiptIndicator from '../ReadReceiptIndicator';

describe('ReadReceiptIndicator', () => {
  const readers = [
    { readerId: 'u_alice', readAt: '2026-01-01T12:00:00Z' },
    { readerId: 'u_bob', readAt: '2026-01-01T12:05:00Z' },
  ];

  const nameForId = (id) => (id === 'u_alice' ? 'Alice' : 'Bob');

  test('shows group read summary', () => {
    render(
      <ReadReceiptIndicator readers={readers} isGroup nameForId={nameForId} currentUserId="u_me" />
    );
    expect(screen.getByText('Read by Alice and Bob')).toBeInTheDocument();
    expect(screen.getByLabelText('Read by Alice and Bob')).toBeInTheDocument();
  });

  test('expands reader list on click in groups', () => {
    render(
      <ReadReceiptIndicator readers={readers} isGroup nameForId={nameForId} currentUserId="u_me" />
    );
    fireEvent.click(screen.getByLabelText('Read by Alice and Bob'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});