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

  it('renders message input and toolbar controls', () => {
    render(<Composer {...defaultProps} />);

    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByTitle('Voice message')).toBeInTheDocument();
    expect(screen.getByTitle('Attach file')).toBeInTheDocument();
    expect(screen.getByTitle('Translate draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Your language')).toBeInTheDocument();
    expect(screen.getByLabelText('Translation target')).toBeInTheDocument();
    expect(screen.getByLabelText('Disappearing timer')).toBeInTheDocument();
  });

  it('updates draft and enables send when text is present', () => {
    const onDraftChange = jest.fn();
    render(<Composer {...defaultProps} draft="hello" onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('hi');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('submits the form when send is clicked', () => {
    const onSend = jest.fn((e) => e.preventDefault());
    render(<Composer {...defaultProps} draft="hello" onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
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

  it('renders poll button when onCreatePoll is provided', () => {
    const onCreatePoll = jest.fn();
    render(<Composer {...defaultProps} onCreatePoll={onCreatePoll} />);

    fireEvent.click(screen.getByTitle('Create poll'));
    expect(onCreatePoll).toHaveBeenCalled();
  });

  it('disables controls when disabled', () => {
    render(<Composer {...defaultProps} draft="hello" disabled />);

    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByTitle('Voice message')).toBeDisabled();
  });
});