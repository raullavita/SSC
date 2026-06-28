import {
  buildQuotePreview,
  findMessageById,
  messagePreviewText,
  senderLabelForMessage,
} from '../messageReply';
import { t } from '../i18n';

const tr = (key, vars) => t(key, 'en', vars);

describe('messageReply', () => {
  const user = { user_id: 'u_me', username: 'me' };
  const peer = { user_id: 'u_peer', username: 'alice' };

  it('finds message by id', () => {
    const messages = [{ message_id: 'm_abc', sender_id: 'u_peer' }];
    expect(findMessageById(messages, 'm_abc')?.sender_id).toBe('u_peer');
    expect(findMessageById(messages, 'm_missing')).toBeNull();
  });

  it('labels peer sender', () => {
    const msg = { sender_id: 'u_peer', message_type: 'text' };
    expect(senderLabelForMessage(msg, { user, peer })).toBe('alice');
  });

  it('builds text quote preview', () => {
    const msg = { message_id: 'm_1', sender_id: 'u_peer', message_type: 'text' };
    const quote = buildQuotePreview(msg, 'Hello world', { user, peer }, tr);
    expect(quote.author).toBe('alice');
    expect(quote.preview).toBe('Hello world');
  });

  it('uses attachment labels for non-text types', () => {
    const msg = { message_id: 'm_2', sender_id: 'u_peer', message_type: 'image' };
    expect(messagePreviewText(msg, '', tr)).toBe(tr('replyPreviewImage'));
  });
});