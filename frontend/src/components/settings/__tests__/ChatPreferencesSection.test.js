import { fireEvent, render, screen } from '@testing-library/react';
import ChatPreferencesSection, {
  loadChatPreferenceDefaults,
} from '../ChatPreferencesSection';
import {
  getAutoTranslateEnabled,
  getLinkPreviewsEnabled,
  getSealedSenderEnabled,
  setAutoTranslateEnabled,
  setLinkPreviewsEnabled,
  setSealedSenderEnabled,
} from '../../../lib/chatPrefs';

describe('ChatPreferencesSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all four chat preference toggles', () => {
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
      />
    );

    expect(screen.getByText('Chat & notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Sealed sender')).toBeInTheDocument();
    expect(screen.getByLabelText('Link previews')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-translate incoming messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Push notification labels')).toBeInTheDocument();
  });

  it('persists sealed sender toggle to localStorage', () => {
    const onSealedSenderChange = jest.fn();
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
        onSealedSenderChange={onSealedSenderChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Sealed sender'));
    expect(getSealedSenderEnabled()).toBe(false);
    expect(onSealedSenderChange).toHaveBeenCalledWith(false);
  });

  it('persists link previews toggle to localStorage', () => {
    const onLinkPreviewsChange = jest.fn();
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
        onLinkPreviewsChange={onLinkPreviewsChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Link previews'));
    expect(getLinkPreviewsEnabled()).toBe(true);
    expect(onLinkPreviewsChange).toHaveBeenCalledWith(true);
  });

  it('persists auto-translate toggle to localStorage', () => {
    const onAutoTranslateChange = jest.fn();
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
        onAutoTranslateChange={onAutoTranslateChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Auto-translate incoming messages'));
    expect(getAutoTranslateEnabled()).toBe(true);
    expect(onAutoTranslateChange).toHaveBeenCalledWith(true);
  });

  it('delegates push rich labels to server-backed callback', () => {
    const onPushRichLabelsChange = jest.fn();
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
        onPushRichLabelsChange={onPushRichLabelsChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Push notification labels'));
    expect(onPushRichLabelsChange).toHaveBeenCalledWith(true);
  });

  it('disables toggles while saving', () => {
    render(
      <ChatPreferencesSection
        sealedSender
        linkPreviews={false}
        autoTranslate={false}
        pushRichLabels={false}
        saving
      />
    );

    expect(screen.getByLabelText('Sealed sender')).toBeDisabled();
    expect(screen.getByLabelText('Push notification labels')).toBeDisabled();
  });
});

describe('loadChatPreferenceDefaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns privacy-first defaults', () => {
    expect(loadChatPreferenceDefaults()).toEqual({
      sealedSender: true,
      linkPreviews: false,
      autoTranslate: false,
    });
  });

  it('reflects stored preferences', () => {
    setSealedSenderEnabled(false);
    setLinkPreviewsEnabled(true);
    setAutoTranslateEnabled(true);

    expect(loadChatPreferenceDefaults()).toEqual({
      sealedSender: false,
      linkPreviews: true,
      autoTranslate: true,
    });
  });
});