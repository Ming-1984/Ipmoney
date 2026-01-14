import { Dialog, Toast } from '@nutui/nutui-react-taro';

import { OVERLAY_IDS } from './AppOverlays';

export function toast(content: string, options?: { duration?: number; icon?: 'success' | 'fail' | 'loading' | 'warn' }) {
  Toast.show(OVERLAY_IDS.toast, {
    content,
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
