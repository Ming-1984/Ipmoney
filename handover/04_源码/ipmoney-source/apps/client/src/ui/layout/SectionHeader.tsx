import { View, Text } from '@tarojs/components';
import React from 'react';

import { Spacer } from './Spacer';

type ViewProps = React.ComponentProps<typeof View>;

export type SectionHeaderAccent = 'primary' | 'gold' | 'none';
export type SectionHeaderDensity = 'default' | 'compact';

function isPrimitive(v: unknown): v is string | number {
  return typeof v === 'string' || typeof v === 'number';
}

export function SectionHeader(
  props: ViewProps & {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    right?: React.ReactNode;
    accent?: SectionHeaderAccent;
    density?: SectionHeaderDensity;
    className?: string;
  },
) {
  const { title, subtitle, right, accent = 'primary', density = 'default', className, ...rest } = props;
  const titleClassName = density === 'compact' ? 'text-card-title' : 'text-title';

  return (
    <View {...rest} className={['section-header', density === 'compact' ? 'section-header-compact' : '', className].filter(Boolean).join(' ')}>
      <View className="row-between" style={{ gap: '12rpx' }}>
        <View className="row min-w-0" style={{ gap: '12rpx', flex: 1 }}>
          {accent === 'none' ? null : (
            <View className={`section-accent ${accent === 'gold' ? 'section-accent-gold' : ''}`} />
          )}
          {isPrimitive(title) ? (
            <Text className={`${titleClassName} clamp-1 flex-1`}>{title}</Text>
          ) : (
            <View className={`${titleClassName} clamp-1 flex-1`}>{title}</View>
          )}
        </View>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>

      {subtitle ? (
        <>
          <Spacer size={8} />
          {isPrimitive(subtitle) ? (
            <Text className="text-caption break-word">{subtitle}</Text>
          ) : (
            <View className="text-caption break-word">{subtitle}</View>
          )}
        </>
      ) : null}
    </View>
  );
}
