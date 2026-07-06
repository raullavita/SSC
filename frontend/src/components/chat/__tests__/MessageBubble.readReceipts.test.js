import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';

describe('MessageBubble read receipts', () => {
  test('shows group read-by names on outgoing messages', () => {
    render(
      <MessageBubble
        message={{
          id: 'm1',
          text: 'Team update',
          message_kind: 'message',
          created_at: new Date().toISOString(),
        }}
        isOutgoing
        userId="u_me"
        isGroup
        readReceipts={[
          { readerId: 'u_alice', readAt: '2026-01-01T12:00:00Z' },
          { readerId: 'u_bob', readAt: '2026-01-01T12:01:00Z' },
        ]}
        nameForId={(id) => (id === 'u_alice' ? 'Alice' : 'Bob')}
      />
    );
    expect(screen.getByText('Read by Alice and Bob')).toBeInTheDocument();
  });

  test('shows single check when no reads yet', () => {
    render(
      <MessageBubble
        message={{
          id: 'm2',
          text: 'Pending',
          message_kind: 'message',
          created_at: new Date().toISOString(),
        }}
        isOutgoing
        userId="u_me"
        readReceipts={[]}
      />
    );
    expect(screen.getByTitle('Sent')).toBeInTheDocument();
  });
});