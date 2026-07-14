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

  const leaveGroup = useCallback(async (groupId) => {
    try {
      return await api.post(`/api/groups/${groupId}/leave`, {});
    } catch (e) {
      setError(e.message || 'Failed to leave group');
      return null;
    }
  }, []);

  const removeMember = useCallback(async (groupId, memberId) => {
    try {
      return await api.delete(`/api/groups/${groupId}/members/${memberId}`);
    } catch (e) {
      setError(e.message || 'Failed to remove member');
      return null;
    }
  }, []);

  const dissolveGroup = useCallback(async (groupId) => {
    try {
      return await api.delete(`/api/groups/${groupId}`);
    } catch (e) {
      setError(e.message || 'Failed to dissolve group');
      return null;
    }
  }, []);

  return {
    groups,
    loadGroups,
    createGroup,
    addMembers,
    leaveGroup,
    removeMember,
    dissolveGroup,
    loading,
    error,
  };
}