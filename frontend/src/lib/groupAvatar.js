/** Group avatar props — Q.26 (shared photo or default icon). */

export function groupAvatarProps(conv) {
  if (!conv?.is_group) {
    return { user: conv?.peer || null, isGroup: false };
  }
  if (conv.group_photo) {
    return { user: { avatar: conv.group_photo }, isGroup: false };
  }
  return { user: null, isGroup: true };
}

export function groupDescriptionLine(conv) {
  const text = conv?.group_description?.trim();
  return text || '';
}