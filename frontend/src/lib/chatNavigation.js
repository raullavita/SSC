/**
 * Chat route helpers — TASK G.2/G.4 (replace vs push).
 */

/** Path for chat list (no active thread). */
export function chatListPath() {
  return '/chat';
}

/** Path for an open thread. */
export function chatThreadPath(conversationId) {
  return `/chat/${conversationId}`;
}

/**
 * React Router options when changing chat layer.
 * Leaving a thread replaces history so system back cannot reopen it.
 */
export function chatNavigateOptions(conversationId) {
  return conversationId ? { replace: false } : { replace: true };
}