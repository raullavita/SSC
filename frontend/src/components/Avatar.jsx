import React from 'react';
import { UsersThree } from '@phosphor-icons/react';
import { isPeerOnline } from '../lib/presence';
import { userInitials } from '../lib/displayName';

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

/**
 * Profile avatar — image URL/data URL or display-name / username initials.
 */
export default function Avatar({
  user,
  size = 'sm',
  showOnline = false,
  isGroup = false,
  className = '',
}) {
  const dim = SIZES[size] || SIZES.sm;
  const src = user?.avatar;
  const initials = userInitials(user);
  const online = showOnline && !isGroup && isPeerOnline(user);

  return (
    <div
      className={`${dim} rounded-md flex items-center justify-center font-mono shrink-0 relative overflow-hidden ${
        isGroup ? 'bg-[#1E2A38]' : 'bg-[#232323]'
      } ${className}`}
      data-testid={user?.username ? `avatar-${user.username}` : 'avatar'}
    >
      {isGroup ? (
        <UsersThree size={size === 'xl' ? 28 : size === 'lg' ? 18 : 16} className="text-[#00E5FF]" />
      ) : src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
      {online && (
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#34C759] rounded-full tac-border" />
      )}
    </div>
  );
}