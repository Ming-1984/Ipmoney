import { View, Text } from '@tarojs/components';
import React from 'react';

import { Check } from '@nutui/icons-react-taro';

import { Cell, CellGroup, Popup } from '../nutui';
import { PopupSheet } from '../layout';

export type SortSheetOption<T> = {
  value: T;
  label: string;
  description?: string;
};

export function SortSheet<T extends string | number>(props: {
  visible: boolean;
  title?: string;
  value: T;
  options: readonly SortSheetOption<T>[];
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Popup
      visible={props.visible}
      position="bottom"
      round
      closeable
      title={props.title ?? '更多排序'}
      onClose={props.onClose}
      onOverlayClick={props.onClose}
    >
      <PopupSheet scrollable={false}>
        <CellGroup divider>
          {props.options.map((opt, idx) => {
            const selected = opt.value === props.value;
            return (
              <Cell
                key={`sort-${idx}`}
                clickable
                title={<Text className="text-strong">{opt.label}</Text>}
                description={opt.description ? <Text className="text-caption">{opt.description}</Text> : undefined}
                extra={selected ? <Check size={16} color="var(--c-primary)" /> : undefined}
                onClick={() => {
                  props.onSelect(opt.value);
                  props.onClose();
                }}
              />
            );
          })}
        </CellGroup>
        <View style={{ height: '16rpx' }} />
      </PopupSheet>
    </Popup>
  );
}
