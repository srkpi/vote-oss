'use client';

import { Avatar, type AvatarShape } from '@/components/ui/avatar';
import { useAvatar, useSelfAvatarSync } from '@/hooks/use-avatar';

interface SelfAvatarProps {
  userId: string;
  fullName: string;
  size?: number;
  shape?: AvatarShape;
  className?: string;
}

export function SelfAvatar({ userId, fullName, size, shape, className }: SelfAvatarProps) {
  useSelfAvatarSync(userId);
  const avatarUrl = useAvatar(userId);
  return <Avatar src={avatarUrl} name={fullName} size={size} shape={shape} className={className} />;
}
