import { useEffect, useState } from 'react';

/** @typedef {{ split: boolean, narrow: boolean }} ChatLayoutMode */

/** Split list + thread when viewport is wide enough (tablet landscape or desktop). */
export function computeChatLayoutMode(width = typeof window !== 'undefined' ? window.innerWidth : 0) {
  const landscape = typeof window !== 'undefined'
    && window.matchMedia('(orientation: landscape)').matches;
  const split = width >= 768 || (width >= 600 && landscape);
  return { split, narrow: !split };
}

function readLayoutMode() {
  if (typeof window === 'undefined') return { split: false, narrow: true };
  return computeChatLayoutMode(window.innerWidth);
}

function useLayoutModeSnapshot() {
  const [mode, setMode] = useState(readLayoutMode);

  useEffect(() => {
    const update = () => setMode(readLayoutMode());
    const queries = [
      window.matchMedia('(min-width: 768px)'),
      window.matchMedia('(min-width: 600px)'),
      window.matchMedia('(orientation: landscape)'),
    ];
    queries.forEach((mq) => mq.addEventListener('change', update));
    window.addEventListener('resize', update);
    update();
    return () => {
      queries.forEach((mq) => mq.removeEventListener('change', update));
      window.removeEventListener('resize', update);
    };
  }, []);

  return mode;
}

/** True when chat list and thread can show side-by-side (Q.3). */
export function useSplitChatLayout() {
  return useLayoutModeSnapshot().split;
}

/** True on phone portrait — single-pane chat navigation. */
export function useMobileLayout() {
  return useLayoutModeSnapshot().narrow;
}