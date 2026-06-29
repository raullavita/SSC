import React from 'react';
import { Hash, Plus } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import {
  canManageGroupTopics,
  sortGroupTopics,
  topicDisplayName,
} from '../lib/groupTopics';

export default function GroupTopicsBar({
  conversation,
  activeTopicId,
  myUserId,
  onSelectTopic,
  onCreateTopic,
}) {
  const { t } = useLocale();
  if (!conversation?.is_group) return null;

  const topics = sortGroupTopics(conversation.group_topics || []);
  const canManage = canManageGroupTopics(conversation, myUserId);

  return (
    <div
      className="border-b border-[#27272A] px-2 md:px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0"
      data-testid="group-topics-bar"
    >
      <Hash size={14} className="text-[#71717A] shrink-0" />
      {topics.map((topic) => {
        const active = topic.topic_id === activeTopicId;
        return (
          <button
            key={topic.topic_id}
            type="button"
            onClick={() => onSelectTopic?.(topic.topic_id)}
            data-testid={`group-topic-${topic.topic_id}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-mono tracking-wide border transition ${
              active
                ? 'bg-[#00E5FF]/15 border-[#00E5FF]/50 text-[#00E5FF]'
                : 'bg-[#121212] border-[#27272A] text-[#A1A1AA] hover:bg-[#1A1A1A]'
            }`}
          >
            {topicDisplayName(topic, t)}
          </button>
        );
      })}
      {canManage && (
        <button
          type="button"
          onClick={onCreateTopic}
          data-testid="group-topic-create"
          className="shrink-0 w-8 h-8 rounded-full border border-[#27272A] bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA]"
          title={t('groupTopicCreate')}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}