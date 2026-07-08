import { readFileSync } from 'fs';
import path from 'path';

describe('ChatHome group call wiring', () => {
  const source = readFileSync(
    path.join(__dirname, '..', 'ChatHome.jsx'),
    'utf8'
  );

  it('passes mesh participants and ws token into useGroupCall', () => {
    expect(source).toMatch(/participantIds:\s*active\?\.participants/);
    expect(source).toMatch(/wsToken,/);
    expect(source).toMatch(/enabled:\s*Boolean\(user && active && isGroup\)/);
  });

  it('wires group answer and decline handlers to CallModal', () => {
    expect(source).toMatch(/answerGroupCall/);
    expect(source).toMatch(/declineGroupCall/);
    expect(source).toMatch(/onAnswer=\{groupCallOpen \? answerGroupCall : answerCall\}/);
    expect(source).toMatch(/onDecline=\{groupCallOpen \? declineGroupCall : declineCall\}/);
  });

  it('loads broadcast lists and exposes composer broadcast send', () => {
    expect(source).toMatch(/listBroadcastLists/);
    expect(source).toMatch(/sendBroadcastMessage/);
    expect(source).toMatch(/onBroadcastSend=/);
  });
});