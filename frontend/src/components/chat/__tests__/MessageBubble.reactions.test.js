import { fireEvent, render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';

describe('MessageBubble reactions UI', () => {
  const baseMessage = {
    id: 'msg_1',
    text: 'Hello world',
    message_kind: 'message',
    created_at: new Date().toISOString(),
  };

  test('shows aggregated reaction chips with counts', () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        userId="u1"
        reactions={[
          { emoji: '👍', count: 3, mine: false },
          { emoji: '❤️', count: 1, mine: true },
        ]}
        onReaction={() => {}}
      />
    );
    expect(screen.getByLabelText('👍 3 reactions')).toBeInTheDocument();
    expect(screen.getByLabelText('❤️ 1 reactions, yours')).toBeInTheDocument();
  });

  test('chip click toggles reaction', () => {
    const onReaction = jest.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        userId="u1"
        reactions={[{ emoji: '🔥', count: 2, mine: false }]}
        onReaction={onReaction}
      />
    );
    fireEvent.click(screen.getByLabelText('🔥 2 reactions'));
    expect(onReaction).toHaveBeenCalledWith('🔥', 'msg_1');
  });

  test('reaction picker adds reaction', () => {
    const onReaction = jest.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        userId="u1"
        onReaction={onReaction}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add reaction' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /React with 😂/ }));
    expect(onReaction).toHaveBeenCalledWith('😂', 'msg_1');
  });

  test('double-click quick reacts with thumbs up', () => {
    const onReaction = jest.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        userId="u1"
        onReaction={onReaction}
      />
    );
    fireEvent.doubleClick(screen.getByText('Hello world').closest('[data-message-id]'));
    expect(onReaction).toHaveBeenCalledWith('👍', 'msg_1');
  });

  test('deleted messages hide reaction controls', () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, message_kind: 'deleted', text: null }}
        isOutgoing={false}
        userId="u1"
        onReaction={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: 'Add reaction' })).not.toBeInTheDocument();
  });

  test('disables reactions while pending', () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        userId="u1"
        reactions={[{ emoji: '👍', count: 1, mine: true }]}
        onReaction={() => {}}
        reactionPending
      />
    );
    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeDisabled();
    expect(screen.getByLabelText('👍 1 reactions, yours')).toBeDisabled();
  });
});