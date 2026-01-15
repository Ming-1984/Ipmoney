import React, { useMemo } from 'react';

import { Tabs } from '../nutui';

export type TabsControlOption<T> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type TabsControlProps<T> = {
  value: T;
  options: readonly TabsControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

function BaseTabsControl<T extends string | number>(props: TabsControlProps<T>) {
  // NutUI Tabs treats falsy `value` as "not provided" and falls back to index.
  // We use a stable index key so option values may safely include ''/0.
  const activeKey = useMemo(() => {
    const idx = props.options.findIndex((opt) => opt.value === props.value);
    return String(idx < 0 ? 0 : idx);
  }, [props.options, props.value]);

  return (
    <Tabs
      activeType="line"
      value={activeKey}
      className={props.className}
      onChange={(next) => {
        const idx = Number(next);
        if (!Number.isFinite(idx)) return;
        const opt = props.options[idx];
        if (!opt || opt.disabled) return;
        props.onChange(opt.value);
      }}
    >
      {props.options.map((opt, idx) => (
        <Tabs.TabPane key={`t-${idx}`} value={String(idx)} title={opt.label} disabled={Boolean(opt.disabled)} />
      ))}
    </Tabs>
  );
}

export function CategoryControl<T extends string | number>(props: TabsControlProps<T>) {
  const className = ['tabs-control', 'tabs-control-category', props.className].filter(Boolean).join(' ');
  return <BaseTabsControl {...props} className={className} />;
}

export function SortControl<T extends string | number>(props: TabsControlProps<T>) {
  const className = ['tabs-control', 'tabs-control-sort', props.className].filter(Boolean).join(' ');
  return <BaseTabsControl {...props} className={className} />;
}

