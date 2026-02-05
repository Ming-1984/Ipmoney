import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Popup, toast } from '../nutui';
import { PopupSheet, Surface } from '../layout';

export type FilterSheetProps<T> = {
  open: boolean;
  title: string;
  value: T;
  defaultValue: T;
  onClose: () => void;
  onApply: (next: T) => void;
  validate?: (draft: T) => string | null;
  variant?: 'default' | 'search';
  headerTitle?: string;
  scrollRatio?: number;
  children: (ctx: { draft: T; setDraft: React.Dispatch<React.SetStateAction<T>> }) => React.ReactNode;
};

export function FilterSheet<T>(props: FilterSheetProps<T>) {
  const [draft, setDraft] = useState<T>(props.value);
  const variant = props.variant ?? 'default';
  const isSearch = variant === 'search';
  const headerTitle = props.headerTitle ?? props.title;
  const scrollRatio = props.scrollRatio ?? (isSearch ? 0.9 : undefined);

  useEffect(() => {
    if (!props.open) return;
    setDraft(props.value);
  }, [props.open, props.value]);

  const reset = useCallback(() => setDraft(props.defaultValue), [props.defaultValue]);

  const canApplyMessage = useMemo(() => props.validate?.(draft) ?? null, [draft, props]);

  const apply = useCallback(() => {
    if (canApplyMessage) {
      toast(canApplyMessage);
      return;
    }
    props.onApply(draft);
    props.onClose();
  }, [canApplyMessage, draft, props]);

  const footerNode = isSearch ? (
    <View className="search-filter-footer">
      <View style={{ flex: 1 }}>
        <Button className="search-filter-reset" variant="ghost" onClick={reset}>
          重置
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        <Button className="search-filter-apply" variant="primary" onClick={apply}>
          确认
        </Button>
      </View>
    </View>
  ) : (
    <Surface>
      <View className="row" style={{ gap: '12rpx' }}>
        <View style={{ flex: 1 }}>
          <Button variant="ghost" onClick={reset}>
            重置
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="primary" onClick={apply}>
            应用
          </Button>
        </View>
      </View>
    </Surface>
  );

  return (
    <Popup
      visible={props.open}
      position="bottom"
      round={!isSearch}
      closeable={!isSearch}
      title={isSearch ? undefined : props.title}
      className={isSearch ? 'search-filter-popup' : undefined}
      onClose={props.onClose}
      onOverlayClick={props.onClose}
    >
      <PopupSheet
        className={isSearch ? 'search-filter-sheet' : undefined}
        bodyClassName={isSearch ? 'search-filter-body' : undefined}
        footerClassName={isSearch ? 'search-filter-actions' : undefined}
        scrollRatio={scrollRatio}
        footer={footerNode}
      >
        {isSearch ? (
          <View className="search-filter-header">
            <View className="search-filter-title">
              <View className="search-filter-accent" />
              <Text>{headerTitle}</Text>
            </View>
            <Text className="search-filter-close" onClick={props.onClose}>
              ×
            </Text>
          </View>
        ) : null}
        {props.children({ draft, setDraft })}
      </PopupSheet>
    </Popup>
  );
}
