import { View, Text, Input } from '@tarojs/components';
import React, { useCallback } from 'react';

import { Close, Search } from '@nutui/icons-react-taro';

export function SearchEntry(props: {
  value: string;
  placeholder: string;
  actionText?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSearch: (value: string) => void;
  onPress?: () => void;
  clearable?: boolean;
}) {
  const actionText = props.actionText ?? '搜索';
  const clearable = props.clearable ?? true;
  const readOnly = Boolean(props.readOnly);

  const onSearch = useCallback(() => {
    if (readOnly) {
      props.onPress?.();
      return;
    }
    props.onSearch(props.value);
  }, [props, readOnly]);

  return (
    <View
      className="search-entry"
      onClick={() => {
        if (readOnly) props.onPress?.();
      }}
    >
      <View className="search-entry-left">
        <Search size={16} color="var(--c-muted)" />
        {readOnly ? (
          <Text className="search-entry-placeholder clamp-1">{props.placeholder}</Text>
        ) : (
          <Input
            className="search-entry-input"
            value={props.value}
            placeholder={props.placeholder}
            onInput={(e) => props.onChange?.(e.detail.value)}
            onConfirm={onSearch}
            confirmType="search"
          />
        )}

        {!readOnly && clearable && props.value ? (
          <View
            className="search-entry-clear"
            onClick={(e) => {
              e.stopPropagation();
              props.onChange?.('');
            }}
          >
            <Close size={14} color="var(--c-muted)" />
          </View>
        ) : null}
      </View>

      <View
        className="search-entry-btn"
        onClick={(e) => {
          e.stopPropagation();
          onSearch();
        }}
      >
        <Search size={14} color="#fff" />
        <Text>{actionText}</Text>
      </View>
    </View>
  );
}

