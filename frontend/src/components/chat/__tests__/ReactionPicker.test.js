import { fireEvent, render, screen } from '@testing-library/react';
import ReactionPicker from '../ReactionPicker';

describe('ReactionPicker', () => {
  test('renders emoji options when open', () => {
    const onPick = jest.fn();
    render(<ReactionPicker open onPick={onPick} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /React with 👍/ }));
    expect(onPick).toHaveBeenCalledWith('👍');
  });

  test('highlights existing mine reactions', () => {
    render(
      <ReactionPicker
        open
        existingReactions={[{ emoji: '❤️', count: 2, mine: true }]}
        onPick={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('menuitem', { name: /Remove ❤️/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});