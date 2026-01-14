import { View } from '@tarojs/components';
import React from 'react';

export function Toolbar(props: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const className = ['toolbar', props.className].filter(Boolean).join(' ');
  return (
    <View className={className}>
      <View className="toolbar-left">{props.left}</View>
      <View className="toolbar-right">{props.right}</View>
    </View>
  );
}

