import { View } from '@tarojs/components';
import React from 'react';

type ViewProps = React.ComponentProps<typeof View>;

export type SurfacePadding = 'none' | 'sm' | 'md';

function paddingClass(padding: SurfacePadding): string {
  if (padding === 'none') return 'surface-pad-none';
  if (padding === 'sm') return 'surface-pad-sm';
  return 'surface-pad-md';
}

export function Surface(props: ViewProps & { className?: string; padding?: SurfacePadding }) {
  const { className, padding = 'md', ...rest } = props;
  const classes = ['surface', paddingClass(padding), className].filter(Boolean).join(' ');
  return <View {...rest} className={classes} />;
}

