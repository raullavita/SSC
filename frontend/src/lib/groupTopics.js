/** Group topics / threads — Q.28 */

import { canEditGroupProfile } from './groupRoles';

export const GENERAL_TOPIC_ID = 'general';

export function getGroupTopics(conv) {
  return conv?.group_topics || [];
}

export function canManageGroupTopics(conv, userId) {
  return canEditGroupProfile(conv, userId);
}

export function topicDisplayName(topic, t) {
  if (!topic) return '';
  if (topic.is_default || topic.topic_id === GENERAL_TOPIC_ID) {
    return t('groupTopicsGeneral');
  }
  return topic.name || t('groupTopicsGeneral');
}

export function messageTopicId(msg) {
  return msg?.topic_id || GENERAL_TOPIC_ID;
}

export function messageBelongsToTopic(msg, topicId) {
  return messageTopicId(msg) === (topicId || GENERAL_TOPIC_ID);
}

export function sortGroupTopics(topics = []) {
  const general = topics.filter((t) => t.topic_id === GENERAL_TOPIC_ID);
  const other = topics
    .filter((t) => t.topic_id !== GENERAL_TOPIC_ID)
    .sort((a, b) => {
      const act = (b.last_activity_at || '').localeCompare(a.last_activity_at || '');
      if (act !== 0) return act;
      return (a.name || '').localeCompare(b.name || '');
    });
  return [...general, ...other];
}