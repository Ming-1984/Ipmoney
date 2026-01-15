import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo } from 'react';

import { Ecc, QrCode } from '../../../lib/qrcodegen';
import { SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';

function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function getCurrentUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.href || null;
}

function addMargin(modules: boolean[][], margin: number): boolean[][] {
  const size = modules.length;
  const nextSize = size + margin * 2;
  const result: boolean[][] = [];
  for (let y = 0; y < nextSize; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < nextSize; x += 1) {
      const inOriginal = x >= margin && x < margin + size && y >= margin && y < margin + size;
      row.push(inOriginal ? Boolean(modules[y - margin]?.[x - margin]) : false);
    }
    result.push(row);
  }
  return result;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function QrGrid(props: { modules: boolean[][]; targetSizeRpx?: number }) {
  const { modules, targetSizeRpx = 320 } = props;
  const total = modules.length;
  const cellRpx = useMemo(() => clampInt(targetSizeRpx / Math.max(total, 1), 4, 10), [targetSizeRpx, total]);
  const sizeRpx = total * cellRpx;

  return (
    <View
      style={{
        alignSelf: 'center',
        padding: '18rpx',
        borderRadius: '18rpx',
        background: 'var(--c-card)',
        border: '1rpx solid var(--c-border)',
        boxShadow: '0 10rpx 22rpx rgba(15, 23, 42, 0.06)',
      }}
    >
      <View style={{ width: `${sizeRpx}rpx`, height: `${sizeRpx}rpx` }}>
        {modules.map((row, y) => (
          <View key={`r-${y}`} style={{ display: 'flex' }}>
            {row.map((cell, x) => (
              <View
                key={`c-${y}-${x}`}
                style={{
                  width: `${cellRpx}rpx`,
                  height: `${cellRpx}rpx`,
                  background: cell ? 'var(--c-text)' : 'transparent',
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function buildWxOpenLaunchWeappHtml(props: { username: string; path: string; buttonText: string }) {
  const { username, path, buttonText } = props;
  const esc = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  return `
<wx-open-launch-weapp username="${esc(username)}" path="${esc(path)}">
  <script type="text/wxtag-template">
    <style>
      .ipm-wx-launch-btn {
        display: block;
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 12px;
        border: none;
        color: #ffffff;
        background: linear-gradient(135deg, #ff6a00, #ff8800);
        box-shadow: 0 10px 22px rgba(255, 106, 0, 0.22);
      }
      .ipm-wx-launch-btn:active {
        opacity: 0.9;
      }
    </style>
    <button class="ipm-wx-launch-btn">${esc(buttonText)}</button>
  </script>
</wx-open-launch-weapp>
`;
}

export function MiniProgramPayGuide(props: {
  miniProgramPath: string;
  title?: string;
  description?: string;
  launchText?: string;
  qrHint?: string;
  targetQrSizeRpx?: number;
}) {
  const { miniProgramPath, title = '去小程序支付', description, launchText = '去小程序支付', qrHint, targetQrSizeRpx } = props;
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;
  const wechat = useMemo(() => (isH5 ? isWechatBrowser() : false), [isH5]);
  const url = useMemo(() => (isH5 ? getCurrentUrl() : null), [isH5]);

  const qrModules = useMemo(() => {
    if (!isH5 || !url) return null;
    try {
      const qr = QrCode.encodeText(url, Ecc.LOW);
      return addMargin(qr.getModules(), 4);
    } catch (_) {
      return null;
    }
  }, [isH5, url]);

  const onCopyLink = useCallback(() => {
    const value = url || '';
    if (!value) {
      toast('链接不可用');
      return;
    }
    Taro.setClipboardData({ data: value });
    toast('已复制链接', { icon: 'success' });
  }, [url]);

  const wxMpUsername = (process.env.TARO_APP_WX_MP_USERNAME || '').trim();
  const openTagHtml = useMemo(() => {
    if (!isH5 || !wechat || !wxMpUsername) return null;
    return buildWxOpenLaunchWeappHtml({ username: wxMpUsername, path: miniProgramPath, buttonText: launchText });
  }, [isH5, launchText, miniProgramPath, wechat, wxMpUsername]);

  if (!isH5) return null;

  const HtmlView = View as unknown as React.ComponentType<any>;

  return (
    <View>
      <Surface>
        <SectionHeader title={title} density="compact" accent="none" />
        <Spacer size={8} />
        <Text className="text-caption break-word">
          {description || 'H5 端不发起支付。微信内可一键跳转小程序；微信外/桌面可复制链接或扫码在微信打开。'}
        </Text>
        <Spacer size={16} />

        {wechat ? (
          <>
            {openTagHtml ? (
              <HtmlView dangerouslySetInnerHTML={{ __html: openTagHtml }} />
            ) : (
              <TipBanner title="提示" tone="warning">
                暂无法一键跳转小程序，请先复制链接在微信打开，或直接在小程序内完成支付。
              </TipBanner>
            )}
            <Spacer size={16} />
            <Button variant="ghost" block={false} onClick={onCopyLink}>
              复制链接
            </Button>
          </>
        ) : (
          <>
            {qrModules ? <QrGrid modules={qrModules} targetSizeRpx={targetQrSizeRpx} /> : null}
            <Spacer size={16} />
            <TipBanner title="使用方式" tone="info">
              {qrHint || '复制链接后，用微信打开（或在桌面端复制到手机微信）；也可用微信扫码打开本页，再跳转小程序完成支付。'}
            </TipBanner>
            <Spacer size={16} />
            <Button variant="primary" onClick={onCopyLink}>
              复制链接
            </Button>
          </>
        )}
      </Surface>
    </View>
  );
}
