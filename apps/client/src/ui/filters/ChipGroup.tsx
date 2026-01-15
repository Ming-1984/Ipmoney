import { View, Text } from '@tarojs/components';
import React, { useCallback, useMemo } from 'react';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type ChipGroupSingleProps<T extends string> = {
  multiple?: false;
  value: T | '';
  options: readonly ChipOption<T>[];
  onChange: (value: T | '') => void;
};

type ChipGroupMultiProps<T extends string> = {
  multiple: true;
  value: readonly T[];
  options: readonly ChipOption<T>[];
  onChange: (value: T[]) => void;
  max?: number;
};

export function ChipGroup<T extends string>(props: ChipGroupSingleProps<T> | ChipGroupMultiProps<T>) {
  const selectedSet = useMemo(() => {
    if (props.multiple) {
      return new Set<T>(props.value);
    }
    const v = props.value as T | '';
    return new Set<T>(v ? [v] : []);
  }, [props]);

  const toggle = useCallback(
    (value: T, disabled?: boolean) => {
      if (disabled) return;

      if (props.multiple) {
        const prev = props.value as readonly T[];
        const next = new Set<T>(prev);
        if (next.has(value)) {
          next.delete(value);
          props.onChange(Array.from(next));
          return;
        }
        const max = props.max ?? Infinity;
        if (next.size >= max) return;
        next.add(value);
        props.onChange(Array.from(next));
        return;
      }

      const current = props.value as T | '';
      props.onChange(current === value ? '' : value);
    },
    [props],
  );

  return (
    <View className="chip-row">
      {props.options.map((opt) => {
        const active = selectedSet.has(opt.value);
        const disabled = Boolean(opt.disabled);
        const className = ['chip', active ? 'chip-active' : '', disabled ? 'chip-disabled' : ''].filter(Boolean).join(' ');
        return (
          <View key={opt.value || '__empty'} className={className} onClick={() => toggle(opt.value, disabled)}>
            <Text>{opt.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
