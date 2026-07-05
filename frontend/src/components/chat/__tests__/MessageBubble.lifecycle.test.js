import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';

describe('MessageBubble lifecycle UI', () => {
  it('shows deleted placeholder', () => {
    render(
      <MessageBubble
        message={{
          id: 'm1',
          message_kind: 'deleted',
          created_at: new Date().toISOString(),
        }}
        isOutgoing={false}
        userId="u1"
      />
    );
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });

  it('shows edited and forwarded labels', () => {
    render(
      <MessageBubble
        message={{
          id: 'm2',
          text: 'hi',
          message_kind: 'message',
          edited_at: new Date().toISOString(),
          forwarded_from: 'm0',
          created_at: new Date().toISOString(),
        }}
        isOutgoing
        userId="u1"
      />
    );
    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.getByText('↪ Forwarded')).toBeInTheDocument();
  });

  it('renders edit action for own recent message', () => {
    render(
      <MessageBubble
        message={{
          id: 'm3',
          sender_id: 'u1',
          text: 'edit me',
          message_kind: 'message',
          created_at: new Date().toISOString(),
        }}
        isOutgoing
        userId="u1"
        onEdit={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});