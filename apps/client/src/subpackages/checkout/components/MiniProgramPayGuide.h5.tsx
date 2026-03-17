import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

export type MiniProgramPayGuideProps = {
  miniProgramPath: string;
  title?: string;
  description?: string;
  launchText?: string;
  qrHint?: string;
  targetQrSizeRpx?: number;
};

export function MiniProgramPayGuide(props: MiniProgramPayGuideProps) {
  const {
    miniProgramPath,
    title = '\u53bb\u5c0f\u7a0b\u5e8f\u652f\u4ed8',
    description,
    launchText = '\u53bb\u5c0f\u7a0b\u5e8f\u652f\u4ed8',
    qrHint,
    targetQrSizeRpx,
  } = props;
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;
  const wechat = useMemo(() => (isH5 ? isWechatBrowser() : false), [isH5]);
  const url = useMemo(() => (isH5 ? getCurrentUrl() : null), [isH5]);
  const [qrModules, setQrModules] = useState<boolean[][] | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isH5 || !url || wechat) {
      setQrLoading(false);
      setQrModules(null);
      return () => {
        alive = false;
      };
    }

    setQrLoading(true);
    import('../../../lib/qrcodegen')
      .then((mod) => {
        if (!alive) return;
        try {
          const qr = mod.QrCode.encodeText(url, mod.Ecc.LOW);
          setQrModules(addMargin(qr.getModules(), 4));
        } catch (_) {
          setQrModules(null);
        }
      })
      .catch(() => {
        if (!alive) return;
        setQrModules(null);
      })
      .finally(() => {
        if (!alive) return;
        setQrLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isH5, url, wechat]);

  const onCopyLink = useCallback(() => {
    const value = url || '';
    if (!value) {
      toast('\u94fe\u63a5\u4e0d\u53ef\u7528');
      return;
    }
    Taro.setClipboardData({ data: value });
    toast('\u5df2\u590d\u5236\u94fe\u63a5', { icon: 'success' });
  }, [url]);

  const wxMpUsername = useMemo(() => {
    if (typeof process === 'undefined' || !process?.env) return '';
    const value = process.env.TARO_APP_WX_MP_USERNAME;
    return typeof value === 'string' ? value.trim() : '';
  }, []);
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
          {description ||
            'H5 \u7aef\u4e0d\u53d1\u8d77\u652f\u4ed8\u3002\u5fae\u4fe1\u5185\u53ef\u4e00\u952e\u8df3\u8f6c\u5c0f\u7a0b\u5e8f\uff1b\u5fae\u4fe1\u5916/\u684c\u9762\u53ef\u590d\u5236\u94fe\u63a5\u6216\u626b\u7801\u5728\u5fae\u4fe1\u6253\u5f00\u3002'}
        </Text>
        <Spacer size={16} />

        {wechat ? (
          <>
            {openTagHtml ? (
              <HtmlView dangerouslySetInnerHTML={{ __html: openTagHtml }} />
            ) : (
              <TipBanner title="\u63d0\u793a" tone="warning">
                {'\u6682\u65e0\u6cd5\u4e00\u952e\u8df3\u8f6c\u5c0f\u7a0b\u5e8f\uff0c\u8bf7\u5148\u590d\u5236\u94fe\u63a5\u5728\u5fae\u4fe1\u6253\u5f00\uff0c\u6216\u76f4\u63a5\u5728\u5c0f\u7a0b\u5e8f\u5185\u5b8c\u6210\u652f\u4ed8\u3002'}
              </TipBanner>
            )}
            <Spacer size={16} />
            <Button variant="ghost" block={false} onClick={onCopyLink}>
              {'\u590d\u5236\u94fe\u63a5'}
            </Button>
          </>
        ) : (
          <>
            {qrModules ? <QrGrid modules={qrModules} targetSizeRpx={targetQrSizeRpx} /> : null}
            {!qrModules && qrLoading ? (
              <>
                <TipBanner title="\u63d0\u793a" tone="info">
                  {'\u6b63\u5728\u751f\u6210\u4e8c\u7ef4\u7801\uff0c\u8bf7\u7a0d\u5019\u3002'}
                </TipBanner>
                <Spacer size={16} />
              </>
            ) : null}
            <Spacer size={16} />
            <TipBanner title="\u4f7f\u7528\u65b9\u5f0f" tone="info">
              {qrHint ||
                '\u590d\u5236\u94fe\u63a5\u540e\uff0c\u7528\u5fae\u4fe1\u6253\u5f00\uff08\u6216\u5728\u684c\u9762\u7aef\u590d\u5236\u5230\u624b\u673a\u5fae\u4fe1\uff09\uff1b\u4e5f\u53ef\u7528\u5fae\u4fe1\u626b\u7801\u6253\u5f00\u672c\u9875\uff0c\u518d\u8df3\u8f6c\u5c0f\u7a0b\u5e8f\u5b8c\u6210\u652f\u4ed8\u3002'}
            </TipBanner>
            <Spacer size={16} />
            <Button variant="primary" onClick={onCopyLink}>
              {'\u590d\u5236\u94fe\u63a5'}
            </Button>
          </>
        )}
      </Surface>
    </View>
  );
}
