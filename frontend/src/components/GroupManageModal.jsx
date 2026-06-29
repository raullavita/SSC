import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, UsersThree, MagnifyingGlass, SignOut, Camera } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { prepareAvatarFile } from '../lib/avatarUpload';
import { groupAvatarProps } from '../lib/groupAvatar';
import { getLocalGroupLabel, setLocalGroupLabel } from '../lib/groupLabels';
import {
  ADD_MEMBERS_ADMINS,
  ADD_MEMBERS_OWNER_ONLY,
  POSTING_ADMINS_ONLY,
  POSTING_ALL,
  ROLE_ADMIN,
  ROLE_MEMBER,
  ROLE_OWNER,
  canAddMembers,
  canEditGroupProfile,
  canManageRoles,
  canRemoveMember,
  getMemberRole,
  roleBadgeKey,
} from '../lib/groupRoles';
import Avatar from './Avatar';

const GROUP_DESCRIPTION_MAX = 280;

export default function GroupManageModal({
  open,
  onClose,
  conversation,
  myUserId,
  contacts = [],
  onUpdated,
  onLeave,
}) {
  const { t } = useLocale();
  const [groupName, setGroupName] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [postingPolicy, setPostingPolicy] = useState(POSTING_ALL);
  const [addMembersPolicy, setAddMembersPolicy] = useState(ADD_MEMBERS_ADMINS);
  const [groupDescription, setGroupDescription] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef(null);

  const members = conversation?.members || [];
  const memberIds = useMemo(
    () => new Set([myUserId, ...members.map((m) => m.user_id)]),
    [members, myUserId],
  );
  const myRole = conversation ? getMemberRole(conversation, myUserId) : ROLE_MEMBER;
  const showAddMembers = conversation ? canAddMembers(conversation, myUserId) : false;
  const showRoleControls = conversation ? canManageRoles(conversation, myUserId) : false;
  const showPermissionControls = showRoleControls;
  const canEditProfile = conversation ? canEditGroupProfile(conversation, myUserId) : false;
  const avatarProps = conversation ? groupAvatarProps(conversation) : { user: null, isGroup: true };

  useEffect(() => {
    if (!open || !conversation) return;
    setGroupName(getLocalGroupLabel(conversation.conversation_id));
    setQ('');
    setPostingPolicy(conversation.group_permissions?.posting || POSTING_ALL);
    setAddMembersPolicy(conversation.group_permissions?.add_members || ADD_MEMBERS_ADMINS);
    setGroupDescription(conversation.group_description || '');
  }, [open, conversation?.conversation_id, conversation?.group_permissions, conversation?.group_description]);

  const addable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts
      .filter((c) => !c.blocked && !memberIds.has(c.user_id))
      .filter((c) => !needle || c.username.toLowerCase().includes(needle))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [contacts, memberIds, q]);

  const saveName = () => {
    if (!conversation) return;
    const trimmed = groupName.trim();
    if (trimmed) setLocalGroupLabel(conversation.conversation_id, trimmed);
    toast.success(t('groupNameSaved'));
    onUpdated?.();
  };

  const saveDescription = async () => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/conversations/${conversation.conversation_id}/group-profile`, {
        description: groupDescription.trim() || null,
      });
      toast.success(t('groupProfileSaved'));
      onUpdated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupProfileFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onPhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !conversation) return;
    setPhotoBusy(true);
    try {
      const prepared = await prepareAvatarFile(file);
      const form = new FormData();
      form.append('file', prepared);
      const { data } = await api.post(
        `/conversations/${conversation.conversation_id}/group-photo`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      toast.success(t('groupProfileSaved'));
      onUpdated?.(data);
    } catch (err) {
      const code = err?.message;
      if (code === 'AVATAR_TYPE') toast.error(t('settingsAvatarTypeError'));
      else if (code === 'AVATAR_TOO_LARGE') toast.error(t('settingsAvatarSizeError'));
      else toast.error(err?.response?.data?.detail || t('groupPhotoFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!conversation) return;
    setPhotoBusy(true);
    try {
      const { data } = await api.delete(`/conversations/${conversation.conversation_id}/group-photo`);
      toast.success(t('groupProfileSaved'));
      onUpdated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupPhotoFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePermissions = async () => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/conversations/${conversation.conversation_id}/group-permissions`, {
        posting: postingPolicy,
        add_members: addMembersPolicy,
      });
      toast.success(t('groupPermissionsSaved'));
      onUpdated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupPermissionsFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (username) => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/conversations/${conversation.conversation_id}/members`, {
        peer_usernames: [username],
      });
      toast.success(t('groupMemberAdded'));
      onUpdated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupMemberAddFailed'));
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (userId, role) => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const { data } = await api.patch(
        `/conversations/${conversation.conversation_id}/members/${userId}/role`,
        { role },
      );
      toast.success(t('groupRoleUpdated'));
      onUpdated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupRoleUpdateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId) => {
    if (!conversation || busy) return;
    const isSelf = userId === myUserId;
    if (!window.confirm(isSelf ? t('groupLeaveConfirm') : t('groupRemoveMemberConfirm'))) return;
    setBusy(true);
    try {
      await api.delete(`/conversations/${conversation.conversation_id}/members/${userId}`);
      toast.success(isSelf ? t('leftGroup') : t('groupMemberRemoved'));
      if (isSelf) {
        onLeave?.();
        onClose?.();
      } else {
        onUpdated?.();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupMemberRemoveFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!open || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UsersThree size={18} className="text-[#00E5FF]" weight="duotone" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('groupManageTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="group-manage-close">
            <X size={16} />
          </button>
        </div>

        <p className="text-[10px] font-mono text-[#71717A] mb-3">{t('groupPrivacyHint')}</p>

        <div className="mb-4 p-3 rounded-md bg-[#1A1A1A] tac-border" data-testid="group-profile-panel">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('groupPhotoLabel')}</p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar {...avatarProps} size="lg" />
              {canEditProfile && (
                <>
                  <button
                    type="button"
                    disabled={photoBusy || busy}
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#00E5FF] text-black flex items-center justify-center shadow-lg"
                    data-testid="group-photo-upload"
                  >
                    <Camera size={14} weight="bold" />
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onPhotoPick} />
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {canEditProfile ? (
                <>
                  <p className="text-[10px] font-mono text-[#71717A]">{t('groupPhotoUpload')}</p>
                  {conversation.group_photo && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={photoBusy || busy}
                      className="mt-2 text-[10px] font-mono text-[#FF3B30] hover:underline"
                      data-testid="group-photo-remove"
                    >
                      {t('groupPhotoRemove')}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[10px] font-mono text-[#71717A]">{t('groupPhotoMembersHint')}</p>
              )}
            </div>
          </div>

          <label className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block mt-3 mb-1">{t('groupDescriptionLabel')}</label>
          {canEditProfile ? (
            <>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder={t('groupDescriptionPlaceholder')}
                className="w-full min-h-[72px] px-3 py-2 text-sm rounded-md bg-[#121212] tac-border resize-y"
                maxLength={GROUP_DESCRIPTION_MAX}
                data-testid="group-description-input"
              />
              <button
                type="button"
                disabled={busy}
                onClick={saveDescription}
                className="mt-2 w-full py-2 text-xs font-mono tracking-wider border border-[#00E5FF]/40 text-[#00E5FF] rounded-md hover:bg-[#00E5FF]/10"
                data-testid="group-description-save"
              >
                {t('groupDescriptionSave')}
              </button>
            </>
          ) : groupDescription.trim() ? (
            <p className="text-sm text-[#F0F0F0] whitespace-pre-wrap" data-testid="group-description-readonly">{groupDescription}</p>
          ) : (
            <p className="text-[10px] font-mono text-[#71717A]">{t('groupDescriptionEmpty')}</p>
          )}
        </div>

        <label className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block mb-1">{t('groupRenameLabel')}</label>
        <div className="flex gap-2 mb-4">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('groupNamePlaceholder')}
            className="flex-1 h-10 px-3 text-sm rounded-md bg-[#1A1A1A] tac-border"
            maxLength={64}
            data-testid="group-manage-name"
          />
          <button
            type="button"
            onClick={saveName}
            className="px-3 text-xs font-mono tac-border rounded-md hover:bg-[#1A1A1A]"
            data-testid="group-manage-save-name"
          >
            {t('saveLabel')}
          </button>
        </div>

        {showPermissionControls && (
          <div className="mb-4 p-3 rounded-md bg-[#1A1A1A] tac-border" data-testid="group-permissions-panel">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('groupPermissionsTitle')}</p>
            <label className="block text-[10px] font-mono text-[#71717A] mb-1">{t('groupPostingPolicyLabel')}</label>
            <select
              value={postingPolicy}
              onChange={(e) => setPostingPolicy(e.target.value)}
              className="w-full h-10 px-3 mb-2 text-sm rounded-md bg-[#121212] tac-border"
              data-testid="group-posting-policy"
            >
              <option value={POSTING_ALL}>{t('groupPostingAll')}</option>
              <option value={POSTING_ADMINS_ONLY}>{t('groupPostingAdminsOnly')}</option>
            </select>
            <label className="block text-[10px] font-mono text-[#71717A] mb-1">{t('groupAddMembersPolicyLabel')}</label>
            <select
              value={addMembersPolicy}
              onChange={(e) => setAddMembersPolicy(e.target.value)}
              className="w-full h-10 px-3 mb-2 text-sm rounded-md bg-[#121212] tac-border"
              data-testid="group-add-members-policy"
            >
              <option value={ADD_MEMBERS_ADMINS}>{t('groupAddMembersAdmins')}</option>
              <option value={ADD_MEMBERS_OWNER_ONLY}>{t('groupAddMembersOwnerOnly')}</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={savePermissions}
              className="w-full py-2 text-xs font-mono tracking-wider border border-[#00E5FF]/40 text-[#00E5FF] rounded-md hover:bg-[#00E5FF]/10"
              data-testid="group-save-permissions"
            >
              {t('groupPermissionsSave')}
            </button>
          </div>
        )}

        <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('groupMembersTitle')}</p>
        <ul className="space-y-1 mb-4">
          {members.map((m) => {
            const role = getMemberRole(conversation, m.user_id);
            const badgeKey = roleBadgeKey(role);
            const removable = canRemoveMember(conversation, myUserId, m.user_id);
            return (
              <li key={m.user_id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-md bg-[#1A1A1A]">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar user={m} size="sm" />
                  <span className="text-sm truncate">@{m.username}</span>
                  {badgeKey && (
                    <span className="text-[9px] font-mono text-[#00E5FF]">{t(badgeKey)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showRoleControls && m.user_id !== myUserId && role !== ROLE_OWNER && (
                    <select
                      value={role}
                      disabled={busy}
                      onChange={(e) => updateRole(m.user_id, e.target.value)}
                      className="text-[10px] font-mono bg-[#121212] tac-border rounded px-1 py-1"
                      data-testid={`group-role-${m.user_id}`}
                    >
                      <option value={ROLE_ADMIN}>{t('groupAdminBadge')}</option>
                      <option value={ROLE_MEMBER}>{t('groupMemberBadge')}</option>
                    </select>
                  )}
                  {removable && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeMember(m.user_id)}
                      className="text-[10px] font-mono text-[#FF453A] hover:underline"
                      data-testid={`group-remove-${m.user_id}`}
                    >
                      {m.user_id === myUserId ? t('leaveGroup') : t('groupRemoveMember')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {showAddMembers ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('groupAddMembersTitle')}</p>
            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-2">
              <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('groupSearchPlaceholder')}
                className="bg-transparent flex-1 outline-none border-0 text-sm"
                data-testid="group-manage-search"
              />
            </div>
            <div className="max-h-40 overflow-y-auto mb-2">
              {addable.length === 0 ? (
                <p className="text-[11px] font-mono text-[#71717A] py-3 text-center">{t('groupNoAddableContacts')}</p>
              ) : (
                addable.map((c) => (
                  <button
                    key={c.user_id}
                    type="button"
                    disabled={busy}
                    onClick={() => addMember(c.username)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1A1A1A] text-sm"
                    data-testid={`group-add-${c.username}`}
                  >
                    @{c.username}
                  </button>
                ))
              )}
            </div>
          </>
        ) : myRole === ROLE_MEMBER && (
          <p className="text-[10px] font-mono text-[#71717A] mb-2">{t('groupCannotAddMembers')}</p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => removeMember(myUserId)}
          className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#FF453A]/40 text-[#FF453A] rounded-md hover:bg-[#FF453A]/10 flex items-center justify-center gap-2"
          data-testid="group-manage-leave"
        >
          <SignOut size={14} /> {t('leaveGroup')}
        </button>
      </div>
    </div>
  );
}