import { View, Text } from '@tarojs/components';
import React from 'react';

export type MetaPillTone = 'default' | 'strong' | 'gold';
export type MetaPill = { label?: string; value?: string; tone?: MetaPillTone };

export function MetaPills(props: { items: MetaPill[]; emptyText?: string; className?: string }) {
  const items = (props.items || []).filter((it) => (it.label && it.label.trim()) || (it.value && it.value.trim()));
  if (!items.length) {
    return props.emptyText ? <Text className="muted">{props.emptyText}</Text> : null;
  }

  return (
    <View className={['meta-pills', props.className].filter(Boolean).join(' ')}>
      {items.map((it, idx) => {
        const tone = it.tone ?? 'default';
        const cls = ['meta-pill', tone === 'strong' ? 'meta-pill-strong' : '', tone === 'gold' ? 'meta-pill-gold' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <View key={`${it.label || ''}-${it.value || ''}-${idx}`} className={cls}>
            {it.label ? <Text className="meta-pill-label">{it.label}</Text> : null}
            {it.label && it.value ? <Text className="meta-pill-sep">·</Text> : null}
            {it.value ? <Text className="clamp-1">{it.value}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
