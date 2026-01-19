import React from 'react';

import { Location, Star, Store, User } from '@nutui/icons-react-taro';

export type AppIconName = 'feeds' | 'inventors' | 'map' | 'organizations' | 'artworks' | 'tech-managers';

const ICONS: Record<AppIconName, React.ComponentType<{ size?: string | number; color?: string }>> = {
  feeds: Star,
  inventors: User,
  map: Location,
  organizations: Store,
  artworks: Star,
  'tech-managers': User,
};

export function AppIcon(props: { name: AppIconName; size?: number; color?: string }) {
  const Comp = ICONS[props.name];
  return <Comp size={props.size ?? 24} color={props.color ?? 'var(--c-primary)'} />;
}
