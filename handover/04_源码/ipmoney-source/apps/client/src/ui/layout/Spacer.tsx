import { View } from '@tarojs/components';
import React from 'react';

export function Spacer(props: { size?: number }) {
  const size = props.size ?? 12;
  return <View style={{ height: `${size}rpx` }} />;
}
