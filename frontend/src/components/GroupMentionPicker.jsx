import React from 'react';
import { useLocale } from '../context/LocaleContext';

export default function GroupMentionPicker({ candidates, onPick }) {
  const { t } = useLocale();
  if (!candidates?.length) return null;

  return (
    <div
      className="border-t border-[#27272A] px-2 py-1 bg-[#101010] max-h-40 overflow-y-auto"
      data-testid="mention-picker"
    >
      <div className="text-[10px] font-mono text-[#A1A1AA] tracking-wider px-1 py-1">
        {t('mentionMember')}
      </div>
      {candidates.map((m) => (
        <button
          key={m.user_id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(m)}
          className="w-full text-left px-2 py-2 rounded-md hover:bg-[#1A1A1A] flex items-center gap-2"
          data-testid={`mention-option-${m.username}`}
        >
          <span className="text-[#00E5FF] font-mono text-sm">@{m.username}</span>
        </button>
      ))}
    </div>
  );
}