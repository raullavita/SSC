import {
  GENERAL_TOPIC_ID,
  messageBelongsToTopic,
  messageTopicId,
  sortGroupTopics,
  topicDisplayName,
} from '../groupTopics';

describe('groupTopics', () => {
  const t = (key) => ({
    groupTopicsGeneral: 'General',
  })[key] || key;

  it('defaults legacy messages to general topic', () => {
    expect(messageTopicId({})).toBe(GENERAL_TOPIC_ID);
    expect(messageBelongsToTopic({}, GENERAL_TOPIC_ID)).toBe(true);
    expect(messageBelongsToTopic({ topic_id: 't_abc' }, 't_abc')).toBe(true);
  });

  it('sorts general first then activity', () => {
    const sorted = sortGroupTopics([
      { topic_id: 't_b', name: 'Beta', last_activity_at: '2026-06-22T00:00:00Z' },
      { topic_id: GENERAL_TOPIC_ID, name: 'General', is_default: true },
      { topic_id: 't_a', name: 'Alpha', last_activity_at: '2026-06-29T00:00:00Z' },
    ]);
    expect(sorted[0].topic_id).toBe(GENERAL_TOPIC_ID);
    expect(sorted[1].topic_id).toBe('t_a');
  });

  it('labels default topic via i18n', () => {
    expect(topicDisplayName({ topic_id: GENERAL_TOPIC_ID, is_default: true }, t)).toBe('General');
    expect(topicDisplayName({ topic_id: 't_x', name: 'Roadmap' }, t)).toBe('Roadmap');
  });
});