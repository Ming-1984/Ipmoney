import { ArrowLeft } from '../icons';
import { NavBar } from '@nutui/nutui-react-taro/dist/es/packages/navbar/navbar';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo } from 'react';

import { isTabPageUrl, safeNavigateBack } from '../../lib/navigation';
import brandLogoPng from '../../assets/brand/logo.png';

export type PageHeaderVariant = 'header' | 'hero';
export type PageHeaderBackMode = boolean | 'auto';

function getCurrentUrlPath(): string {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    const current = pages[pages.length - 1] as any;
    const route = (current?.route as string | undefined) ?? (current?.$taroPath as string | undefined) ?? '';
    if (!route) return '';
    return route.startsWith('/') ? route : `/${route}`;
  } catch {
    return '';
  }
}

export function PageHeader(props: {
  back?: PageHeaderBackMode;
  brand?: boolean;
  fallbackUrl?: string;
  // deprecated: use `fallbackUrl`
  backFallbackUrl?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  variant?: PageHeaderVariant;
  weapp?: boolean;
}) {
  const variant = props.variant ?? 'header';

  const isWeapp = process.env.TARO_ENV === 'weapp';
  const renderInWeapp = Boolean(props.weapp);

  const currentUrlPath = useMemo(() => getCurrentUrlPath(), []);
  const isTabPage = useMemo(() => (currentUrlPath ? isTabPageUrl(currentUrlPath) : false), [currentUrlPath]);

  const showBack = useMemo(() => {
    if (props.back === false) return false;
    if (props.back === true) return true;
    return !isTabPage;
  }, [isTabPage, props.back]);

  const showBrand = props.brand ?? true;
  const fallbackUrl = props.fallbackUrl ?? props.backFallbackUrl;
  const onBackClick = useCallback(() => {
    void safeNavigateBack({ fallbackUrl });
  }, [fallbackUrl]);

  // WeApp uses the native navigation bar. Rendering a custom NavBar causes a duplicated top bar/back button.
  useEffect(() => {
    if (!isWeapp || renderInWeapp) return;
    if (typeof props.title !== 'string' && typeof props.title !== 'number') return;
    Taro.setNavigationBarTitle({ title: String(props.title) });
  }, [isWeapp, props.title, renderInWeapp]);

  const statusBarHeight = useMemo(() => {
    if (!isWeapp || !renderInWeapp) return 0;
    try {
      return Taro.getSystemInfoSync().statusBarHeight || 0;
    } catch {
      return 0;
    }
  }, [isWeapp, renderInWeapp]);

  const weappStyle = useMemo(() => {
    if (!isWeapp || !renderInWeapp) return undefined;
    return { paddingTop: `${statusBarHeight}px`, background: 'rgba(255, 255, 255, 0.96)' };
  }, [isWeapp, renderInWeapp, statusBarHeight]);

  const renderTitle = useCallback(
    (className: string) => {
      if (typeof props.title === 'string' || typeof props.title === 'number') {
        return <Text className={className}>{props.title}</Text>;
      }
      return props.title;
    },
    [props.title],
  );

  const renderSubtitle = useCallback(() => {
    if (!props.subtitle) return null;
    if (typeof props.subtitle === 'string' || typeof props.subtitle === 'number') {
      return <Text className="page-navbar-subtitle">{props.subtitle}</Text>;
    }
    return props.subtitle;
  }, [props.subtitle]);

  if (isWeapp && !renderInWeapp) return null;

  if (isWeapp && renderInWeapp) {
    return (
      <View className={variant === 'hero' ? 'page-navbar page-navbar-hero' : 'page-navbar'} style={weappStyle}>
        <View className="page-navbar-native">
          <View className="page-navbar-native-side page-navbar-native-side-left">
            {showBack ? (
              <View className="page-header-back" onClick={onBackClick}>
                <ArrowLeft size={18} color="var(--c-text)" />
              </View>
            ) : showBrand ? (
              <View className="page-navbar-logo">
                <Image className="page-navbar-logo-img" src={brandLogoPng} mode="aspectFit" />
              </View>
            ) : null}
          </View>
          <View className="page-navbar-native-center">
            {renderTitle('page-navbar-title')}
          </View>
          <View className="page-navbar-native-side page-navbar-native-side-right">{props.right}</View>
        </View>
        {variant === 'hero' && props.subtitle ? (
          <View className="page-navbar-hero-subtitle">{renderSubtitle()}</View>
        ) : null}
      </View>
    );
  }

  return (
    <View className={variant === 'hero' ? 'page-navbar page-navbar-hero' : 'page-navbar'} style={weappStyle}>
      <NavBar
        title={
          renderTitle('page-navbar-title')
        }
        back={showBack ? <ArrowLeft size={18} color="var(--c-text)" /> : undefined}
        onBackClick={onBackClick}
        left={
          showBrand ? (
            <View className={`page-navbar-logo${showBack ? ' page-navbar-logo-with-back' : ''}`}>
              <Image className="page-navbar-logo-img" src={brandLogoPng} mode="aspectFit" />
            </View>
          ) : undefined
        }
        right={props.right}
      />
      {variant === 'hero' && props.subtitle ? (
        <View className="page-navbar-hero-subtitle">{renderSubtitle()}</View>
      ) : null}
    </View>
  );
}
