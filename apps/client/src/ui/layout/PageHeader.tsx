import { View, Text } from '@tarojs/components';
import React from 'react';

import { Card } from './Card';

export type PageHeaderVariant = 'header' | 'hero';

export function PageHeader(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  variant?: PageHeaderVariant;
}) {
  const variant = props.variant ?? 'header';
  const className = variant === 'hero' ? 'card-hero' : 'card-header';
  const titleClassName = variant === 'hero' ? 'text-hero' : 'text-title';

  return (
    <Card className={className}>
      <View className="row-between">
        <View style={{ flex: 1 }}>
          <Text className={titleClassName}>{props.title}</Text>
          {props.subtitle ? (
            <>
              <View style={{ height: '6rpx' }} />
              {typeof props.subtitle === 'string' || typeof props.subtitle === 'number' ? (
                <Text className="text-subtitle">{props.subtitle}</Text>
              ) : (
                <View className="text-subtitle">{props.subtitle}</View>
              )}
            </>
          ) : null}
        </View>
        {props.right ? <View style={{ marginLeft: '16rpx' }}>{props.right}</View> : null}
      </View>
    </Card>
  );
}
