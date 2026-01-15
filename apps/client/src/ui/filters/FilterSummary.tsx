import { View, Text } from '@tarojs/components';
import React, { useMemo } from 'react';

export function FilterSummary(props: {
  labels: readonly string[];
  emptyText?: string;
  max?: number;
}) {
  const max = props.max ?? 3;
  const labels = props.labels || [];

  const { head, restCount } = useMemo(() => {
    const headLabels = labels.slice(0, max);
    const more = Math.max(0, labels.length - headLabels.length);
    return { head: headLabels, restCount: more };
  }, [labels, max]);

  if (!labels.length) {
    return <Text className="muted">{props.emptyText ?? '未设置筛选'}</Text>;
  }

  return (
    <View className="filters-summary">
      {head.map((label) => (
        <Text key={label} className="tag tag-active">
          {label}
        </Text>
      ))}
      {restCount ? (
        <Text className="tag" style={{ background: 'rgba(15, 23, 42, 0.06)', color: 'var(--c-muted)' }}>
          +{restCount}
        </Text>
      ) : null}
    </View>
  );
}

