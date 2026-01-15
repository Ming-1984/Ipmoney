import { View, Text } from '@tarojs/components';
import React, { useMemo } from 'react';

import { usePublicIndustryTags } from '../../lib/industryTags';
import { Button } from '../nutui';
import type { ChipOption } from './ChipGroup';
import { ChipGroup } from './ChipGroup';

export function IndustryTagsPicker(props: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const { names, loading, error, reload } = usePublicIndustryTags();

  const options = useMemo(() => {
    const disabled = Boolean(props.disabled);
    const base = names.map(
      (name) =>
        ({
          value: name,
          label: name,
          ...(disabled ? { disabled: true } : {}),
        }) satisfies ChipOption<string>,
    );
    const selected = (props.value || []).filter(Boolean);
    const extras = selected
      .filter((t) => !names.includes(t))
      .map(
        (t) =>
          ({
            value: t,
            label: t,
            ...(disabled ? { disabled: true } : {}),
          }) satisfies ChipOption<string>,
      );
    return [...base, ...extras];
  }, [names, props.disabled, props.value]);

  return (
    <View>
      {loading ? <Text className="muted">加载中…</Text> : null}
      {error ? (
        <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
          <Text className="muted">{error}</Text>
          <Button size="small" variant="ghost" block={false} onClick={reload}>
            重试
          </Button>
        </View>
      ) : null}

      <ChipGroup<string>
        multiple
        max={props.max}
        value={(props.value || []) as string[]}
        options={options}
        onChange={props.disabled ? () => {} : props.onChange}
      />
    </View>
  );
}
