import { View } from '@tarojs/components';
import React from 'react';

import type { IconBadgeVariant } from './IconBadge';
import { IconBadge } from './IconBadge';

export type StateIllustrationKind = 'loading' | 'error' | 'empty' | 'permission' | 'audit' | 'missing';

const VARIANT_BY_KIND: Record<StateIllustrationKind, IconBadgeVariant> = {
  loading: 'gold',
  error: 'slate',
  empty: 'brand',
  permission: 'blue',
  audit: 'purple',
  missing: 'slate',
};

export function StateIllustration(props: { kind: StateIllustrationKind; size?: 'sm' | 'md' }) {
  const { kind, size = 'sm' } = props;
  return (
    <IconBadge variant={VARIANT_BY_KIND[kind]} size={size}>
      <View className="state-illust-core" />
    </IconBadge>
  );
}

