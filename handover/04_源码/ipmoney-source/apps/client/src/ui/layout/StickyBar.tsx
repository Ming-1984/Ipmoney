import { View } from '@tarojs/components';
import React from 'react';

export function StickyBar(props: { children: React.ReactNode }) {
  return (
    <View className="sticky-bar">
      <View className="sticky-actions">{props.children}</View>
    </View>
  );
}

