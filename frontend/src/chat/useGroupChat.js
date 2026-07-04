/**
 * Group chat hook — Engine 9.
 */

import { useCallback, useState } from 'react';
import { api } from '../lib/api';

export function useGroupChat() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/groups');
      setGroups(data.groups || []);
      return data.groups;
    } catch (e) {
      setError(e.message || 'Failed to load groups');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (name, memberIds) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/api/groups', { name, member_ids: memberIds });
      setGroups((prev) => [data.group, ...prev]);
      return data;
    } catch (e) {
      setError(e.message || 'Failed to create group');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addMembers = useCallback(async (groupId, memberIds) => {
    try {
      return await api.post(`/api/groups/${groupId}/members`, { member_ids: memberIds });
    } catch (e) {
      setError(e.message || 'Failed to add members');
      return null;
    }
  }, []);

  return { groups, loadGroups, createGroup, addMembers, loading, error };
}