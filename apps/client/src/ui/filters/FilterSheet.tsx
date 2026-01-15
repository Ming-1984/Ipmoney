import { View } from '@tarojs/components';
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
  children: (ctx: { draft: T; setDraft: React.Dispatch<React.SetStateAction<T>> }) => React.ReactNode;
};

export function FilterSheet<T>(props: FilterSheetProps<T>) {
  const [draft, setDraft] = useState<T>(props.value);

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

  return (
    <Popup
      visible={props.open}
      position="bottom"
      round
      closeable
      title={props.title}
      onClose={props.onClose}
      onOverlayClick={props.onClose}
    >
      <PopupSheet
        footer={
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
        }
      >
        {props.children({ draft, setDraft })}
      </PopupSheet>
    </Popup>
  );
}
