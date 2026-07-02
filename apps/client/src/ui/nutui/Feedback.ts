import Taro from '@tarojs/taro';
import Dialog from '@nutui/nutui-react-taro/dist/es/packages/dialog';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast';

import { OVERLAY_IDS } from './AppOverlays';

function normalizeToastContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) return content.map((item) => normalizeToastContent(item)).filter(Boolean).join(' ');
  if (content instanceof Error) return content.message || '操作失败';
  if (typeof content === 'object') {
    const payload = content as Record<string, unknown>;
    const messageLike = [payload.message, payload.msg, payload.title, payload.detail]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .find(Boolean);
    if (messageLike) return messageLike;
    return '操作失败，请稍后重试';
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function toast(content: unknown, options?: { duration?: number; icon?: 'success' | 'fail' | 'loading' | 'warn' }) {
  const safeContent = normalizeToastContent(content);
  const env = typeof Taro.getEnv === 'function' ? Taro.getEnv() : process.env.TARO_ENV;
  const envText = typeof env === 'string' ? env.toLowerCase() : '';
  const isWeapp = env === Taro.ENV_TYPE.WEAPP || envText === 'weapp';
  if (isWeapp) {
    void Taro.showToast({
      title: safeContent,
      icon: options?.icon === 'loading' ? 'loading' : safeContent.length <= 7 && options?.icon === 'success' ? 'success' : 'none',
      duration: Math.max(1, options?.duration ?? 2) * 1000,
    }).catch(() => {
      // Keep NutUI as a fallback for runtimes where native toast is unavailable.
      Toast.show(OVERLAY_IDS.toast, {
        content: safeContent,
        duration: options?.duration ?? 2,
        icon: options?.icon,
      });
    });
    return;
  }
  Toast.show(OVERLAY_IDS.toast, {
    content: safeContent,
    duration: options?.duration ?? 2,
    icon: options?.icon,
  });
}

const WEAPP_MODAL_ACTION_TEXT_MAX_LENGTH = 4;

function normalizeWeappModalActionText(text: string | undefined, fallback: string): string {
  const value = String(text || fallback).trim() || fallback;
  return Array.from(value).slice(0, WEAPP_MODAL_ACTION_TEXT_MAX_LENGTH).join('');
}

export function confirm(options: {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  const env = typeof Taro.getEnv === 'function' ? Taro.getEnv() : process.env.TARO_ENV;
  const envText = typeof env === 'string' ? env.toLowerCase() : '';
  const isWeapp = env === Taro.ENV_TYPE.WEAPP || envText === 'weapp';
  if (isWeapp) {
    return Taro.showModal({
      title: options.title,
      content: options.content,
      confirmText: normalizeWeappModalActionText(options.confirmText, '确定'),
      cancelText: normalizeWeappModalActionText(options.cancelText, '取消'),
      showCancel: true,
    })
      .then((res) => Boolean(res.confirm))
      .catch(() => {
        void Taro.showToast({ title: '确认框打开失败', icon: 'none' }).catch(() => undefined);
        return false;
      });
  }
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
      Dialog.close(OVERLAY_IDS.dialog);
    };

    Dialog.open(OVERLAY_IDS.dialog, {
      title: options.title,
      content: options.content,
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      onConfirm: () => done(true),
      onCancel: () => done(false),
      onClose: () => done(false),
      closeOnOverlayClick: true,
    });
  });
}
