import { render, screen, waitFor } from '@testing-library/react';
import { setLinkPreviewsEnabled } from '../../../lib/chatPrefs';
import * as linkPreview from '../../../lib/linkPreview';
import MessageBubble from '../MessageBubble';

describe('MessageBubble link previews', () => {
  beforeEach(() => {
    localStorage.clear();
    setLinkPreviewsEnabled(true);
    jest.spyOn(linkPreview, 'fetchPreviewsForText').mockResolvedValue([
      {
        url: 'https://example.com',
        hostname: 'example.com',
        title: 'Example',
        description: 'Desc',
        image: null,
        limited: true,
      },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders link preview cards for messages with URLs', async () => {
    render(
      <MessageBubble
        message={{
          id: 'm1',
          text: 'Check https://example.com',
          message_kind: 'message',
          created_at: new Date().toISOString(),
        }}
        isOutgoing={false}
        userId="u1"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /example/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('skips previews for deleted messages', async () => {
    render(
      <MessageBubble
        message={{
          id: 'm2',
          text: 'https://example.com',
          message_kind: 'deleted',
          created_at: new Date().toISOString(),
        }}
        isOutgoing={false}
        userId="u1"
      />
    );

    expect(screen.queryByRole('link', { name: /example/i })).not.toBeInTheDocument();
    expect(linkPreview.fetchPreviewsForText).not.toHaveBeenCalled();
  });
});