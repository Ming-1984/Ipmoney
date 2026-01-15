import { ArrowLeft } from '@nutui/icons-react-taro';
import { NavBar } from '@nutui/nutui-react-taro';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo } from 'react';

import brandLogoGif from '../../assets/brand/logo.gif';
import { isTabPageUrl, safeNavigateBack } from '../../lib/navigation';

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
}) {
  const variant = props.variant ?? 'header';

  const isWeapp = process.env.TARO_ENV === 'weapp';

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
    if (!isWeapp) return;
    if (typeof props.title !== 'string' && typeof props.title !== 'number') return;
    Taro.setNavigationBarTitle({ title: String(props.title) });
  }, [isWeapp, props.title]);

  if (isWeapp) return null;

  return (
    <View className={variant === 'hero' ? 'page-navbar page-navbar-hero' : 'page-navbar'}>
      <NavBar
        title={
          typeof props.title === 'string' || typeof props.title === 'number' ? (
            <Text className="page-navbar-title">{props.title}</Text>
          ) : (
            props.title
          )
        }
        back={showBack ? <ArrowLeft size={18} color="var(--c-text)" /> : undefined}
        onBackClick={onBackClick}
        left={
          showBrand ? (
            <View className={`page-navbar-logo${showBack ? ' page-navbar-logo-with-back' : ''}`}>
              <Image className="page-navbar-logo-img" src={brandLogoGif} mode="aspectFit" />
            </View>
          ) : undefined
        }
        right={props.right}
      />
      {variant === 'hero' && props.subtitle ? (
        <View className="page-navbar-hero-subtitle">
          {typeof props.subtitle === 'string' || typeof props.subtitle === 'number' ? (
            <Text className="page-navbar-subtitle">{props.subtitle}</Text>
          ) : (
            props.subtitle
          )}
        </View>
      ) : null}
    </View>
  );
}
