import { View } from '@tarojs/components';
import React from 'react';

import { ArrowRight } from '@nutui/icons-react-taro';

import { Cell } from '../nutui';

export function CellRow(props: React.ComponentProps<typeof Cell> & { arrow?: boolean }) {
  const { arrow = true, extra, ...rest } = props;

  return (
    <Cell
      {...rest}
      extra={
        arrow ? (
          <View className="cellrow-extra">
            {extra}
            <ArrowRight size={14} color="var(--c-muted)" />
          </View>
        ) : (
          extra
        )
      }
    />
  );
}
