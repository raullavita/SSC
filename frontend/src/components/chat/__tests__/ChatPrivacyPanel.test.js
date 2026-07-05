import { fireEvent, render, screen } from '@testing-library/react';
import ChatPrivacyPanel from '../ChatPrivacyPanel';

describe('ChatPrivacyPanel', () => {
  it('renders privacy toggles when open', () => {
    render(
      <ChatPrivacyPanel
        open
        onClose={() => {}}
        overrides={{}}
        globalSettings={{ read_receipts: false }}
        onPatch={() => {}}
      />
    );
    expect(screen.getByText('Chat privacy')).toBeInTheDocument();
    expect(screen.getByText('Read receipts')).toBeInTheDocument();
    expect(screen.getByText('Typing indicator')).toBeInTheDocument();
  });

  it('calls onPatch when changing read receipts', () => {
    const onPatch = jest.fn();
    render(
      <ChatPrivacyPanel
        open
        onClose={() => {}}
        overrides={{}}
        globalSettings={{ read_receipts: false }}
        onPatch={onPatch}
      />
    );
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'on' } });
    expect(onPatch).toHaveBeenCalledWith({ read_receipts: true });
  });
});