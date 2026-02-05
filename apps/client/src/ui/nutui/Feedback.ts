import Taro from '@tarojs/taro';
import { Dialog, Toast } from '@nutui/nutui-react-taro';

import { OVERLAY_IDS } from './AppOverlays';

function normalizeToastContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) return content.map((item) => normalizeToastContent(item)).filter(Boolean).join(' ');
  if (content instanceof Error) return content.message || '操作失败';
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function toast(content: unknown, options?: { duration?: number; icon?: 'success' | 'fail' | 'loading' | 'warn' }) {
  const safeContent = normalizeToastContent(content);
  Toast.show(OVERLAY_IDS.toast, {
    content: safeContent,
    duration: options?.duration ?? 2,
    icon: options?.icon,
  });
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
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      showCancel: true,
    })
      .then((res) => Boolean(res.confirm))
      .catch(() => false);
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
