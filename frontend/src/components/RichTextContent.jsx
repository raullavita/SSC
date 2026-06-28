import React from 'react';
import { splitTextForHighlight } from '../lib/chatSearch';
import { splitTextForMentions } from '../lib/groupMentions';
import { parseInlineSegments, parseRichTextBlocks } from '../lib/richText';

function InlineLeaf({ text, searchQuery, className = '' }) {
  if (!searchQuery?.trim()) {
    return <span className={className}>{text}</span>;
  }
  const parts = splitTextForHighlight(text, searchQuery);
  return (
    <span className={className}>
      {parts.map((part, i) => (
        part.match
          ? <mark key={i} className="bg-[#FFD600]/35 text-inherit rounded-sm px-0.5">{part.text}</mark>
          : <span key={i}>{part.text}</span>
      ))}
    </span>
  );
}

function InlineFormatted({
  text,
  searchQuery,
  isGroup,
  groupMembers,
  myUserId,
  mentionedUserIds,
}) {
  const mentionParts = isGroup
    ? splitTextForMentions(text, groupMembers)
    : [{ text, isMention: false }];
  const mentionedSet = new Set(mentionedUserIds || []);

  return (
    <>
      {mentionParts.map((mentionPart, mi) => {
        if (mentionPart.isMention) {
          const forMe = mentionPart.userId === myUserId || mentionedSet.has(mentionPart.userId);
          return (
            <span
              key={`m-${mi}`}
              className={forMe
                ? 'text-[#00E5FF] font-medium bg-[#00E5FF]/20 rounded-sm px-0.5'
                : 'text-[#00E5FF] font-medium'}
              data-testid={forMe ? 'mention-for-me' : 'mention'}
            >
              {mentionPart.text}
            </span>
          );
        }
        const inline = parseInlineSegments(mentionPart.text);
        return inline.map((seg, si) => {
          const key = `s-${mi}-${si}`;
          if (seg.kind === 'bold') {
            return (
              <strong key={key} className="font-semibold">
                <InlineLeaf text={seg.text} searchQuery={searchQuery} />
              </strong>
            );
          }
          if (seg.kind === 'italic') {
            return (
              <em key={key} className="italic">
                <InlineLeaf text={seg.text} searchQuery={searchQuery} />
              </em>
            );
          }
          return <InlineLeaf key={key} text={seg.text} searchQuery={searchQuery} />;
        });
      })}
    </>
  );
}

export default function RichTextContent({
  text,
  searchQuery = '',
  isGroup = false,
  groupMembers = [],
  myUserId,
  mentionedUserIds = [],
}) {
  const blocks = parseRichTextBlocks(text);
  return (
    <div className="rich-text-content whitespace-pre-wrap break-words" data-testid="rich-text-content">
      {blocks.map((block, bi) => {
        if (block.type === 'spacer') {
          return <div key={`sp-${bi}`} className="h-2" aria-hidden />;
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag
              key={`li-${bi}`}
              className={block.ordered ? 'list-decimal list-inside my-1' : 'list-disc list-inside my-1'}
            >
              {block.items.map((item, ii) => (
                <li key={`li-${bi}-${ii}`}>
                  <InlineFormatted
                    text={item}
                    searchQuery={searchQuery}
                    isGroup={isGroup}
                    groupMembers={groupMembers}
                    myUserId={myUserId}
                    mentionedUserIds={mentionedUserIds}
                  />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={`p-${bi}`} className={bi > 0 ? 'mt-1' : undefined}>
            <InlineFormatted
              text={block.text}
              searchQuery={searchQuery}
              isGroup={isGroup}
              groupMembers={groupMembers}
              myUserId={myUserId}
              mentionedUserIds={mentionedUserIds}
            />
          </p>
        );
      })}
    </div>
  );
}