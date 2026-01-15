import { View, Text, Input } from '@tarojs/components';
import React, { useCallback, useMemo, useState } from 'react';

import { Close } from '@nutui/icons-react-taro';

import { Button, toast } from '../nutui';

function normalizeTag(value: string): string {
  return (value || '').trim().replace(/\s+/g, ' ');
}

export function TagInput(props: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}) {
  const max = props.max ?? 8;
  const disabled = Boolean(props.disabled);
  const [input, setInput] = useState('');

  const tags = useMemo(() => (props.value || []).filter(Boolean), [props.value]);

  const remove = useCallback(
    (tag: string) => {
      if (disabled) return;
      props.onChange(tags.filter((t) => t !== tag));
    },
    [disabled, props, tags],
  );

  const add = useCallback(() => {
    if (disabled) return;
    const next = normalizeTag(input);
    if (!next) return;
    if (tags.includes(next)) {
      toast('标签已存在');
      return;
    }
    if (tags.length >= max) {
      toast(`最多添加 ${max} 个标签`);
      return;
    }
    props.onChange([...tags, next]);
    setInput('');
  }, [disabled, input, max, props, tags]);

  return (
    <View className="taginput">
      {tags.length ? (
        <View className="taginput-tags">
          {tags.map((tag) => (
            <View key={tag} className="taginput-tag">
              <Text className="clamp-1" style={{ maxWidth: '200rpx' }}>
                {tag}
              </Text>
              <View className="taginput-remove" onClick={() => remove(tag)} style={disabled ? { opacity: 0.4 } : undefined}>
                <Close size={12} color="var(--c-muted)" />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text className="muted">未添加标签</Text>
      )}

      <View style={{ height: '10rpx' }} />

      <View className="taginput-add">
        <View className="taginput-input-wrap">
          <Input
            className="taginput-input"
            value={input}
            disabled={disabled}
            placeholder={props.placeholder ?? '输入标签并添加'}
            onInput={(e) => setInput(e.detail.value)}
            onConfirm={add}
            confirmType="done"
          />
        </View>
        <Button size="small" variant="primary" block={false} onClick={add} disabled={disabled}>
          添加
        </Button>
      </View>
    </View>
  );
}
