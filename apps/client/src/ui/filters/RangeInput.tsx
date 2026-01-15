import { View, Input, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

function fenToYuanText(fen?: number): string {
  if (fen === undefined || fen === null) return '';
  const n = Math.round(fen / 100);
  return Number.isFinite(n) ? String(n) : '';
}

function yuanTextToFen(text: string): number | undefined {
  const t = (text || '').trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0) return undefined;
  return Math.round(n * 100);
}

export function RangeInput(props: {
  minFen?: number;
  maxFen?: number;
  onChange: (next: { minFen?: number; maxFen?: number }) => void;
  placeholderMin?: string;
  placeholderMax?: string;
  disabled?: boolean;
  unit?: string;
}) {
  const unit = props.unit ?? '元';

  const [minText, setMinText] = useState(() => fenToYuanText(props.minFen));
  const [maxText, setMaxText] = useState(() => fenToYuanText(props.maxFen));

  useEffect(() => setMinText(fenToYuanText(props.minFen)), [props.minFen]);
  useEffect(() => setMaxText(fenToYuanText(props.maxFen)), [props.maxFen]);

  const minFen = useMemo(() => yuanTextToFen(minText), [minText]);
  const maxFen = useMemo(() => yuanTextToFen(maxText), [maxText]);

  const error = useMemo(() => {
    if (minFen !== undefined && maxFen !== undefined && minFen > maxFen) return '最小值不能大于最大值';
    return null;
  }, [minFen, maxFen]);

  const emit = useCallback(
    (nextMinText: string, nextMaxText: string) => {
      props.onChange({
        minFen: yuanTextToFen(nextMinText),
        maxFen: yuanTextToFen(nextMaxText),
      });
    },
    [props],
  );

  return (
    <View className="range-input">
      <View className="range-input-row">
        <View className="range-input-field">
          <Input
            className="range-input-input"
            type="digit"
            value={minText}
            placeholder={props.placeholderMin ?? `最小${unit}`}
            disabled={props.disabled}
            onInput={(e) => {
              const next = e.detail.value;
              setMinText(next);
              emit(next, maxText);
            }}
          />
        </View>
        <Text className="range-input-sep">—</Text>
        <View className="range-input-field">
          <Input
            className="range-input-input"
            type="digit"
            value={maxText}
            placeholder={props.placeholderMax ?? `最大${unit}`}
            disabled={props.disabled}
            onInput={(e) => {
              const next = e.detail.value;
              setMaxText(next);
              emit(minText, next);
            }}
          />
        </View>
      </View>
      {error ? <Text className="text-caption" style={{ color: 'var(--c-danger)' }}>{error}</Text> : null}
    </View>
  );
}

