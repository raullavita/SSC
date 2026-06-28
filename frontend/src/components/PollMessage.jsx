import React, { useMemo } from 'react';
import { useLocale } from '../context/LocaleContext';
import {
  canVoteOnPoll,
  myPollVote,
  parsePollPayload,
  pollVoteStats,
} from '../lib/pollMessage';

export default function PollMessage({
  msg,
  plaintext,
  myUserId,
  onPollVote,
  voting = false,
}) {
  const { t } = useLocale();
  const poll = useMemo(() => parsePollPayload(plaintext), [plaintext]);
  const optionCount = poll?.options?.length || msg.poll_option_count || 0;
  const votes = msg.poll_votes || [];
  const { counts, total } = useMemo(
    () => pollVoteStats(votes, optionCount),
    [votes, optionCount],
  );
  const myVote = myPollVote(votes, myUserId);
  const canVote = canVoteOnPoll(msg) && Boolean(onPollVote);

  if (!poll) {
    return <p className="text-xs text-[#A1A1AA]">{t('pollDecryptFailed')}</p>;
  }

  return (
    <div className="space-y-2 min-w-[200px] max-w-[280px]" data-testid={`poll-${msg.message_id}`}>
      <p className="text-sm font-medium text-[#F0F0F0]">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((label, index) => {
          const count = counts[index] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = myVote === index;
          return (
            <button
              key={`${msg.message_id}-opt-${index}`}
              type="button"
              disabled={!canVote || voting}
              onClick={() => onPollVote?.(msg, index)}
              className={`relative w-full text-left rounded-md overflow-hidden tac-border disabled:opacity-60 ${
                selected ? 'border-[#00E5FF]/50' : 'border-[#27272A]'
              }`}
              data-testid={`poll-option-${msg.message_id}-${index}`}
            >
              {total > 0 && (
                <span
                  className={`absolute inset-y-0 left-0 ${selected ? 'bg-[#00E5FF]/20' : 'bg-[#27272A]/80'}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              )}
              <span className="relative z-[1] flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className={selected ? 'text-[#00E5FF]' : 'text-[#F0F0F0]'}>{label}</span>
                {total > 0 && (
                  <span className="font-mono text-[10px] text-[#A1A1AA] shrink-0">
                    {pct}%
                    {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] font-mono text-[#71717A] tracking-wider">
        {total > 0
          ? t('pollVoteCount', { count: String(total) })
          : t('pollNoVotesYet')}
      </p>
    </div>
  );
}