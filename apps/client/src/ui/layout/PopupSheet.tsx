import { ScrollView, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';

type PopupSheetProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  scrollClassName?: string;
  footerClassName?: string;
  scrollable?: boolean;
  scrollRatio?: number;
};

const DEFAULT_SCROLL_RATIO = 0.78;

function resolveScrollHeight(ratio: number): string {
  if (process.env.TARO_ENV === 'h5') return `${Math.round(ratio * 100)}vh`;
  try {
    const info = Taro.getSystemInfoSync();
    return `${Math.round(info.windowHeight * ratio)}px`;
  } catch {
    return `${Math.round(ratio * 100)}vh`;
  }
}

export function PopupSheet({
  children,
  footer,
  className,
  bodyClassName,
  scrollClassName,
  footerClassName,
  scrollable = true,
  scrollRatio = DEFAULT_SCROLL_RATIO,
}: PopupSheetProps) {
  const isH5 = process.env.TARO_ENV === 'h5';
  const scrollHeight = useMemo(() => resolveScrollHeight(scrollRatio), [scrollRatio]);
  const bodyClasses = `popup-sheet-body${footer ? '' : ' popup-sheet-body-standalone'}${bodyClassName ? ` ${bodyClassName}` : ''}`;
  const scrollClasses = `popup-sheet-scroll${scrollClassName ? ` ${scrollClassName}` : ''}`;

  const bodyNode = <View className={bodyClasses}>{children}</View>;

  return (
    <View className={`popup-sheet${className ? ` ${className}` : ''}`}>
      {scrollable ? (
        isH5 ? (
          <View className={scrollClasses} style={{ maxHeight: scrollHeight }}>
            {bodyNode}
          </View>
        ) : (
          <ScrollView className={scrollClasses} scrollY style={{ height: scrollHeight }}>
            {bodyNode}
          </ScrollView>
        )
      ) : (
        <View className={scrollClasses}>{bodyNode}</View>
      )}
      {footer ? <View className={`popup-sheet-actions${footerClassName ? ` ${footerClassName}` : ''}`}>{footer}</View> : null}
    </View>
  );
}
