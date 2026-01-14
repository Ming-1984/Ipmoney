import { View } from '@tarojs/components';
import React from 'react';

import { Surface } from './layout';
import { Skeleton } from './nutui';

function SkeletonLine(props: { width?: string | number; size?: 'small' | 'normal' | 'large' }) {
  return (
    <Skeleton
      rows={1}
      size={props.size ?? 'normal'}
      shape="round"
      animated
      duration={1.1}
      visible={false}
      width={props.width}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <View className="listing-item">
      <SkeletonLine width="88%" size="normal" />
      <View style={{ height: '12rpx' }} />
      <SkeletonLine width="64%" size="small" />
      <View style={{ height: '14rpx' }} />
      <View className="row" style={{ gap: '10rpx' }}>
        <SkeletonLine width="38%" size="small" />
        <SkeletonLine width="38%" size="small" />
      </View>
    </View>
  );
}

export function ListingListSkeleton(props: { count?: number }) {
  const count = props.count ?? 6;
  return (
    <Surface padding="none" className="listing-list">
      {Array.from({ length: count }).map((_, idx) => (
        <ListingCardSkeleton key={idx} />
      ))}
    </Surface>
  );
}
