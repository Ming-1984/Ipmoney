import React from 'react';

import { Avatar as NutAvatar, AvatarGroup } from '@nutui/nutui-react-taro';

type NutAvatarProps = React.ComponentProps<typeof NutAvatar>;

const PLACEHOLDER_AVATAR_RE = /^https?:\/\/example\.com\//i;

function normalizeAvatarSrc(src?: NutAvatarProps['src']): NutAvatarProps['src'] {
  if (typeof src !== 'string') return src;
  const value = src.trim();
  if (!value) return '';
  if (PLACEHOLDER_AVATAR_RE.test(value)) return '';
  return value;
}

export function Avatar(props: NutAvatarProps) {
  const src = normalizeAvatarSrc(props.src);
  return <NutAvatar {...props} src={src} />;
}

export { AvatarGroup };
