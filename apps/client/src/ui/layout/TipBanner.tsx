import { View, Text } from '@tarojs/components';
import React from 'react';

import { Button } from '../nutui';
import { Spacer } from './Spacer';

type ViewProps = React.ComponentProps<typeof View>;

export type TipBannerTone = 'info' | 'success' | 'warning';

function isPrimitive(v: unknown): v is string | number {
  return typeof v === 'string' || typeof v === 'number';
}

export function TipBanner(
  props: ViewProps & {
    tone?: TipBannerTone;
    title?: React.ReactNode;
    children: React.ReactNode;
    action?: React.ReactNode;
    actionText?: string;
    onAction?: () => void;
    className?: string;
  },
) {
  const { tone = 'info', title, children, action, actionText, onAction, className, ...rest } = props;
  const actionNode =
    action ??
    (actionText && onAction ? (
      <Button variant="ghost" size="small" block={false} onClick={onAction}>
        {actionText}
      </Button>
    ) : null);

  return (
    <View {...rest} className={['tip-banner', `tip-banner-${tone}`, className].filter(Boolean).join(' ')}>
      <View className="tip-banner-accent" />
      <View className="tip-banner-body">
        {title ? (
          <>
            {isPrimitive(title) ? <Text className="text-strong">{title}</Text> : <View className="text-strong">{title}</View>}
            <Spacer size={8} />
          </>
        ) : null}
        {isPrimitive(children) ? <Text className="text-caption break-word">{children}</Text> : <View className="text-caption break-word">{children}</View>}
      </View>
      {actionNode ? (
        <View style={{ flexShrink: 0 }}>
          {actionNode}
        </View>
      ) : null}
    </View>
  );
}
