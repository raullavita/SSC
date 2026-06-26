import React, { useEffect, useRef } from 'react';
import { DotsThreeVertical } from '@phosphor-icons/react';

export default function MobileChatMenu({
  open,
  onToggle,
  onClose,
  children,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open, onClose]);

  return (
    <div className="relative md:hidden z-[80]" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className="w-10 h-10 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center"
        data-testid="chat-menu-button"
        aria-label="Chat actions"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-[90] min-w-[180px] bg-[#1A1A1A] tac-border rounded-md shadow-xl py-1 fade-up">
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuAction({ onClick, children, danger, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`w-full text-left px-3 py-2.5 text-xs font-mono tracking-wider active:bg-[#232323] ${danger ? 'text-[#FF3B30]' : 'text-[#F0F0F0]'}`}
    >
      {children}
    </button>
  );
}