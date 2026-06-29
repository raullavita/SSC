import React from 'react';
import { parseHelpInlineSegments, parseHelpMarkdownBlocks } from '../lib/help/helpMarkdown';

function HelpInline({ text }) {
  const segments = parseHelpInlineSegments(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'link') {
          const external = /^https?:\/\//i.test(seg.href);
          return (
            <a
              key={i}
              href={seg.href}
              className="text-[#00E5FF] hover:underline"
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {seg.text}
            </a>
          );
        }
        if (seg.kind === 'bold') {
          return <strong key={i} className="font-semibold text-[#F0F0F0]">{seg.text}</strong>;
        }
        if (seg.kind === 'italic') {
          return <em key={i} className="italic">{seg.text}</em>;
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}

export default function HelpMarkdownContent({ text, className = '' }) {
  const blocks = parseHelpMarkdownBlocks(text);
  return (
    <div className={`help-markdown text-sm text-[#A1A1AA] leading-relaxed ${className}`} data-testid="help-markdown">
      {blocks.map((block, bi) => {
        if (block.type === 'spacer') {
          return <div key={`sp-${bi}`} className="h-2" aria-hidden />;
        }
        if (block.type === 'heading') {
          const Tag = block.level === 2 ? 'h3' : 'h4';
          return (
            <Tag
              key={`h-${bi}`}
              className={`font-medium text-[#F0F0F0] ${bi > 0 ? 'mt-4' : ''} ${block.level === 2 ? 'text-base' : 'text-sm'}`}
            >
              <HelpInline text={block.text} />
            </Tag>
          );
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag
              key={`li-${bi}`}
              className={`my-2 pl-4 ${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1`}
            >
              {block.items.map((item, ii) => (
                <li key={`li-${bi}-${ii}`}>
                  <HelpInline text={item} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={`p-${bi}`} className={bi > 0 ? 'mt-2' : undefined}>
            <HelpInline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}