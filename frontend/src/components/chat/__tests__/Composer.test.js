import { fireEvent, render, screen } from '@testing-library/react';
import Composer from '../Composer';

const defaultProps = {
  draft: '',
  onDraftChange: jest.fn(),
  onSend: jest.fn((e) => e.preventDefault()),
  onTranslate: jest.fn(),
  translatedPreview: null,
  onUseTranslation: jest.fn(),
  onDismissTranslation: jest.fn(),
  translateTarget: 'en',
  onTranslateTargetChange: jest.fn(),
  userLang: 'en',
  onUserLangChange: jest.fn(),
  languages: ['en', 'es'],
  disappearingSeconds: 0,
  onDisappearingChange: jest.fn(),
  recording: false,
  onVoiceToggle: jest.fn(),
  uploading: false,
  onFileClick: jest.fn(),
  onFileSelected: jest.fn(),
};

describe('Composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders main row: tools, message, voice (empty draft)', () => {
    render(<Composer {...defaultProps} />);

    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByLabelText('Message tools')).toBeInTheDocument();
    expect(screen.getByLabelText('Voice message')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();
  });

  it('shows send when draft has text', () => {
    const onDraftChange = jest.fn();
    render(<Composer {...defaultProps} draft="hello" onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('hi');
    expect(screen.getByLabelText('Send')).toBeEnabled();
  });

  it('submits the form when send is clicked', () => {
    const onSend = jest.fn((e) => e.preventDefault());
    render(<Composer {...defaultProps} draft="hello" onSend={onSend} />);

    fireEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenCalled();
  });

  it('shows translation preview actions when preview is set', () => {
    render(
      <Composer
        {...defaultProps}
        draft="hola"
        translatedPreview="hello"
        translateTarget="en"
      />
    );

    expect(screen.getByText(/Translation \(en\): hello/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use translation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('opens tools panel with poll when onCreatePoll is provided', () => {
    const onCreatePoll = jest.fn();
    render(<Composer {...defaultProps} onCreatePoll={onCreatePoll} />);

    fireEvent.click(screen.getByLabelText('Message tools'));
    fireEvent.click(screen.getByTitle('Create poll'));
    expect(onCreatePoll).toHaveBeenCalled();
  });

  it('disables controls when disabled', () => {
    render(<Composer {...defaultProps} draft="hello" disabled />);

    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByLabelText('Send')).toBeDisabled();
    expect(screen.getByLabelText('Message tools')).toBeDisabled();
  });

  it('renders broadcast list in tools when lists are provided', () => {
    const onBroadcastSend = jest.fn();
    render(
      <Composer
        {...defaultProps}
        draft="hello"
        broadcastLists={[{ id: 'bl_1', name: 'Team', recipient_ids: ['u1', 'u2'] }]}
        onBroadcastSend={onBroadcastSend}
      />
    );

    fireEvent.click(screen.getByLabelText('Message tools'));
    const select = screen.getByLabelText('Broadcast list');
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'bl_1' } });
    expect(onBroadcastSend).toHaveBeenCalledWith('bl_1');
  });

  it('exposes translate and disappear controls in tools panel', () => {
    render(<Composer {...defaultProps} draft="hello" />);
    fireEvent.click(screen.getByLabelText('Message tools'));
    expect(screen.getByTitle('Translate draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Your language')).toBeInTheDocument();
    expect(screen.getByLabelText('Translation target')).toBeInTheDocument();
    expect(screen.getByLabelText('Disappearing timer')).toBeInTheDocument();
    expect(screen.getByTitle('Attach file')).toBeInTheDocument();
  });
});
