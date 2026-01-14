import { View } from '@tarojs/components';
import React from 'react';

type ViewProps = React.ComponentProps<typeof View>;

export function Card(props: ViewProps & { className?: string }) {
  const { className, ...rest } = props;
  return <View {...rest} className={className ? `card ${className}` : 'card'} />;
}

