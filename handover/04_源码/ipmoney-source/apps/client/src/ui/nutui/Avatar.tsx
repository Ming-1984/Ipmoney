import React, { useEffect, useState } from 'react';

import { Avatar as NutAvatar } from '@nutui/nutui-react-taro/dist/es/packages/avatar/avatar';
import { AvatarGroup } from '@nutui/nutui-react-taro/dist/es/packages/avatargroup/avatargroup';

type NutAvatarProps = React.ComponentProps<typeof NutAvatar>;

const PLACEHOLDER_AVATAR_RE = /^https?:\/\/example\.com\//i;
const INVALID_AVATAR_VALUES = new Set(['null', 'undefined', 'none', 'n/a']);

function normalizeAvatarSrc(src?: NutAvatarProps['src']): NutAvatarProps['src'] {
  if (typeof src !== 'string') return src;
  const value = src.trim();
  if (!value) return '';
  if (INVALID_AVATAR_VALUES.has(value.toLowerCase())) return '';
  if (PLACEHOLDER_AVATAR_RE.test(value)) return '';
  return value;
}

export function Avatar(props: NutAvatarProps) {
  const normalizedSrc = normalizeAvatarSrc(props.src);
  const [hasError, setHasError] = useState(false);
  const { mode, fit, icon, children, onError, ...rest } = props;
  const showFallback = !normalizedSrc || hasError;

  useEffect(() => {
    setHasError(false);
  }, [normalizedSrc]);

  return (
    <NutAvatar
      {...rest}
      src={showFallback ? '' : normalizedSrc}
      mode={mode ?? 'aspectFill'}
      fit={fit ?? 'cover'}
      icon={showFallback ? icon : undefined}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
    >
      {showFallback ? children : null}
    </NutAvatar>
  );
}

export { AvatarGroup };
