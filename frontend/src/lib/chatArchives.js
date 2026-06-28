/**
 * Per-user archived chat partitioning for the sidebar.
 */

export function partitionSidebarConversations(conversations = []) {
  const active = conversations.filter((c) => !c.archived);
  const archived = conversations.filter((c) => c.archived);
  return { active, archived };
}

export function sortArchivedConversations(conversations = []) {
  return [...conversations].sort(
    (a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''),
  );
}