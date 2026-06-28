/**
 * Per-user pinned chat ordering for the sidebar.
 */

export function sortSidebarConversations(conversations = []) {
  const pinned = conversations.filter((c) => c.pinned);
  const unpinned = conversations.filter((c) => !c.pinned);
  pinned.sort((a, b) => (b.pinned_at || '').localeCompare(a.pinned_at || ''));
  unpinned.sort((a, b) => {
    const aKey = a.last_activity_at || a.created_at || '';
    const bKey = b.last_activity_at || b.created_at || '';
    return bKey.localeCompare(aKey);
  });
  return [...pinned, ...unpinned];
}