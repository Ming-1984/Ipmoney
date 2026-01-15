import { View } from '@tarojs/components';
import React from 'react';

type ViewProps = React.ComponentProps<typeof View>;

export type IconBadgeVariant = 'brand' | 'purple' | 'blue' | 'green' | 'slate' | 'gold';
export type IconBadgeSize = 'sm' | 'md';

export function IconBadge(props: ViewProps & { variant?: IconBadgeVariant; size?: IconBadgeSize; className?: string }) {
  const { variant = 'brand', size = 'md', className, ...rest } = props;
  const classes = [
    'icon-badge',
    size === 'sm' ? 'icon-badge-sm' : 'icon-badge-md',
    `icon-badge-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <View {...rest} className={classes} />;
}

